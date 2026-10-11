import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { createTelegramClient } from "./telegram-api.js";

const telegram = createTelegramClient(config.telegramBotToken);
const runtimeDir = path.dirname(config.eventStatePath);
const offsetPath = path.join(runtimeDir, "telegram-offset.json");
const lockPath = path.join(runtimeDir, "telegram-bot.lock");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function sessionExists() {
  return fs.access(config.authStatePath).then(() => true, () => false);
}

function formatTime(value) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

async function replyFor(text) {
  const command = text.trim().split(/\s/u)[0].split("@")[0].toLowerCase();
  if (command === "/start" || command === "/help") {
    const hasSession = await sessionExists();
    return [
      "✅ Bot điểm rèn luyện IUH đã kết nối với bạn.",
      "",
      hasSession
        ? "Đã có phiên IUH cục bộ. Dùng /status để xem lần kiểm tra hoạt động gần nhất."
        : "Chưa có phiên IUH. Mở Đăng nhập IUH.cmd trên máy tính và đăng nhập một lần. Bộ theo dõi local sẽ tự dùng phiên mới.",
      "",
      "/status — Tình trạng theo dõi",
      "/events — Danh sách hoạt động lấy gần nhất",
      "/help — Hướng dẫn",
    ].join("\n");
  }
  if (command === "/status") {
    const state = await readJson(config.eventStatePath, null);
    if (!(await sessionExists())) {
      return "🟡 Telegram đang hoạt động.\nMở Đăng nhập IUH.cmd trên máy tính và đăng nhập một lần. Bot sẽ tự tiếp tục theo dõi.";
    }
    if (state?.authStatus === "required") {
      return "🟡 Phiên IUH đã hết hạn.\nMở Đăng nhập IUH.cmd trên máy tính để đăng nhập lại. Bot sẽ tự dùng phiên mới; không cần khởi động lại.";
    }
    if (!state?.checkedAt) {
      return "🟡 Đã có file phiên IUH, chưa có lần thu thập thành công được ghi nhận. Chạy npm start trên máy tính.";
    }
    const isRecent = Date.now() - Date.parse(state.checkedAt) < Math.max(120_000, config.pollIntervalMs * 3);
    return [
      isRecent && !state.lastError ? "🟢 Có dữ liệu IUH được cập nhật gần đây." : "🟡 Theo dõi chưa cập nhật hoặc đang gặp lỗi.",
      `Kiểm tra thành công gần nhất: ${formatTime(state.checkedAt)}`,
      `Chu kỳ kiểm tra: ${config.pollIntervalMs / 1000} giây`,
      `Hoạt động trong lần kiểm tra đó: ${Object.keys(state.events || {}).length}`,
      state.lastError ? "Có lỗi trong lần kiểm tra gần nhất. Xem terminal của bộ theo dõi để biết chi tiết." : "",
      state.lastNotificationError ? "Đang có thông báo chờ gửi lại do lỗi kết nối Telegram." : "",
      `Thông báo đang chờ: ${(state.pendingNotifications || []).length}`,
    ].filter(Boolean).join("\n");
  }
  if (command === "/events") {
    const state = await readJson(config.eventStatePath, null);
    if (!state?.checkedAt) return "Chưa có dữ liệu hoạt động. Cần đăng nhập IUH và bật bộ theo dõi trên máy tính.";
    const events = Object.values(state.events || {});
    return [
      `📋 Dữ liệu lần lấy lúc ${formatTime(state.checkedAt)}`,
      ...events.slice(0, 10).map((event, index) =>
        `${index + 1}. ${event.name}\nĐiểm: ${event.points || "?"} | Hạn: ${event.deadline || "?"}\n${event.status || "Chưa rõ trạng thái"}`),
      events.length === 0 ? "Hiện không có hoạt động trong danh sách." : "",
      events.length > 10 ? `Đang hiển thị 10/${events.length} hoạt động.` : "",
      config.url,
    ].filter(Boolean).join("\n\n").slice(0, 4000);
  }
  return "Gửi /status để kiểm tra bot, /events để xem hoạt động hoặc /help để xem hướng dẫn.";
}

async function acquireLock() {
  await fs.mkdir(runtimeDir, { recursive: true });
  try {
    const lock = await fs.open(lockPath, "wx");
    await lock.writeFile(String(process.pid));
    await lock.close();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const pid = Number(await fs.readFile(lockPath, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("File khóa bot không hợp lệ.");
    try {
      process.kill(pid, 0);
    } catch (processError) {
      if (processError.code !== "ESRCH") throw processError;
      await fs.unlink(lockPath);
      return acquireLock();
    }
    throw new Error("Đã có một tiến trình trả lời Telegram đang chạy.");
  }
}

async function main() {
  if (!config.telegramBotToken || !config.telegramChatId) {
    throw new Error("Cần TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong .env.");
  }
  await acquireLock();
  try {
    const webhook = await telegram("getWebhookInfo");
    if (webhook.url) throw new Error("Bot có webhook; không thể chạy bộ nhận lệnh bằng getUpdates.");
    const bot = await telegram("getMe");
    let { offset } = await readJson(offsetPath, { offset: 0 });
    console.log(`Telegram @${bot.username} đang nhận lệnh. PID=${process.pid}`);
    let stopping = false;
    process.once("SIGINT", () => { stopping = true; });
    process.once("SIGTERM", () => { stopping = true; });
    while (!stopping) {
      try {
        const updates = await telegram("getUpdates", { offset, timeout: 25, limit: 100 });
        for (const update of updates) {
          const message = update.message;
          if (message?.chat?.type === "private" && String(message.chat.id) === config.telegramChatId && message.text) {
            await telegram("sendMessage", {
              chat_id: config.telegramChatId,
              text: await replyFor(message.text),
            });
            console.log(`Đã trả lời lệnh Telegram (update ${update.update_id}).`);
          }
          offset = update.update_id + 1;
          await fs.writeFile(`${offsetPath}.tmp`, JSON.stringify({ offset }));
          await fs.rename(`${offsetPath}.tmp`, offsetPath);
        }
      } catch (error) {
        console.error(error.message);
        await new Promise((resolve) => setTimeout(resolve, Math.max(5, error.retryAfter || 0) * 1000));
      }
    }
  } finally {
    await fs.unlink(lockPath).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
