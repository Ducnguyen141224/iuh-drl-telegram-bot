import fs from "node:fs/promises";
import path from "node:path";
import { launchChrome, readEvents } from "./browser.js";
import { config } from "./config.js";
import { formatNotification, normalizeEvent } from "./core.js";
import { createNotifier } from "./notifier.js";
import { acquireProcessLock, readJson, writeJson } from "./storage.js";
import { applyObservation } from "./watcher-state.js";

const once = process.argv.includes("--once");
const notifier = createNotifier(config);

const loadState = () => readJson(config.eventStatePath, { events: {}, initialized: false });
const saveState = (state) => writeJson(config.eventStatePath, state);
const runtimeDir = path.dirname(config.eventStatePath);

async function authSignature() {
  try {
    const stat = await fs.stat(config.authStatePath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function drainNotifications(state) {
  while (state.pendingNotifications?.length) {
    const notice = state.pendingNotifications[0];
    try {
      await notifier.send(formatNotification(notice, config.url));
    } catch (error) {
      state.lastNotificationError = error.message;
      await saveState(state);
      console.error(error.message);
      return;
    }
    state.pendingNotifications.shift();
    state.sentNotifications = [...(state.sentNotifications || []), {
      key: notice.key, sentAt: new Date().toISOString(),
    }].slice(-1000);
    state.lastNotificationError = "";
    await saveState(state);
  }
}

async function main() {
  const release = await acquireProcessLock(path.join(runtimeDir, "watcher.lock"));
  let browser;
  let context;
  let page;
  let loadedSignature;
  let blockedSignature;
  let stopping = false;
  let failures = 0;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  console.log(`Theo dõi IUH mỗi ${config.pollIntervalMs / 1000}s, tự tải lại phiên khi đăng nhập lại.`);
  try {
    do {
      let state = await loadState();
      await drainNotifications(state);
      let waitMs = config.pollIntervalMs;
      try {
        const signature = await authSignature();
        if (!signature || signature === blockedSignature) {
          const error = new Error(signature
            ? "Phiên IUH hết hạn. Mở Đăng nhập IUH.cmd trên máy để đăng nhập lại."
            : "Chưa có phiên IUH. Mở Đăng nhập IUH.cmd trên máy và đăng nhập một lần.");
          error.code = "AUTH_REQUIRED";
          throw error;
        }
        if (!browser?.isConnected()) {
          browser = await launchChrome({ headless: config.headless, executablePath: config.executablePath });
          context = null;
        }
        if (!context || loadedSignature !== signature) {
          await context?.close().catch(() => {});
          context = await browser.newContext({ storageState: config.authStatePath });
          page = await context.newPage();
          loadedSignature = signature;
        }
        const events = (await readEvents(page, config.url)).map(normalizeEvent);
        // Never replace a more recent manual login with cookies from an old context.
        if ((await authSignature()) === loadedSignature) {
          await writeJson(config.authStatePath, await context.storageState());
          loadedSignature = await authSignature();
        }
        const recovered = state.authStatus === "required";
        state = applyObservation(state, events, config);
        await saveState(state); // Persist the outbox before sending messages.
        await drainNotifications(state);
        if (recovered) {
          await notifier.send("✅ Phiên IUH đã hoạt động trở lại. Bot tiếp tục theo dõi hoạt động.").catch(() => {});
        }
        failures = 0;
        blockedSignature = null;
        console.log(`[${new Date().toISOString()}] ${events.length} hoạt động, đã lưu phiên và trạng thái.`);
      } catch (error) {
        const authRequired = error.code === "AUTH_REQUIRED";
        if (authRequired) {
          error.message = (await authSignature())
            ? "Phiên IUH hết hạn. Mở Đăng nhập IUH.cmd trên máy để đăng nhập lại."
            : "Chưa có phiên IUH. Mở Đăng nhập IUH.cmd trên máy và đăng nhập một lần.";
        }
        state = await loadState();
        state.lastError = `${error.code || error.name}:${error.message}`;
        state.attemptedAt = new Date().toISOString();
        state.authStatus = authRequired ? "required" : "error";
        if (authRequired) blockedSignature = loadedSignature || null;
        await saveState(state);
        if (state.lastAlertedError !== state.lastError) {
          try {
            await notifier.send(`⚠️ Bot IUH cần chú ý\n\n${error.message}`);
            state.lastAlertedError = state.lastError;
            await saveState(state);
          } catch (notifyError) { console.error(notifyError.message); }
        }
        console.error(`[${new Date().toISOString()}] ${error.message}`);
        if (!authRequired) failures += 1;
        waitMs = authRequired ? config.pollIntervalMs : Math.min(300_000, config.pollIntervalMs * 2 ** Math.min(failures, 4));
        if (once) process.exitCode = authRequired ? 2 : 1;
      }
      if (once || stopping) break;
      await new Promise((resolve) => {
        const deadline = Date.now() + waitMs;
        const timer = setInterval(() => {
          if (stopping || Date.now() >= deadline) { clearInterval(timer); resolve(); }
        }, 500);
      });
    } while (!stopping);
  } finally {
    await browser?.close().catch(() => {});
    await release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = error.code === "ALREADY_RUNNING" ? 3 : 1;
});
