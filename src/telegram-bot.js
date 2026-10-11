import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { createTelegramClient } from "./telegram-api.js";
import { isSubscribed, readSubscribers, subscribe, unsubscribe } from "./subscribers.js";

const telegram = createTelegramClient(config.telegramBotToken);
const runtimeDir = path.dirname(config.eventStatePath);
const offsetPath = path.join(runtimeDir, "telegram-offset.json");
const lockPath = path.join(runtimeDir, "telegram-bot.lock");
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let loginProcess = null;

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

async function sendText(chatId, text) {
  await telegram("sendMessage", { chat_id: chatId, text });
}

function triggerLogin() {
  if (loginProcess && loginProcess.exitCode == null) {
    return "🟡 Cửa sổ đăng nhập IUH đang mở trên máy. Hãy hoàn tất đăng nhập và CAPTCHA trong Chrome.";
  }

  const child = spawn(process.execPath, [path.join(projectDir, "src", "login.js"), "--wait"], {
    cwd: projectDir,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  loginProcess = child;
  child.once("error", (error) => {
    if (loginProcess === child) loginProcess = null;
    sendText(config.telegramChatId, `❌ Không thể mở cửa sổ đăng nhập IUH: ${error.message}`).catch(console.error);
  });
  child.once("exit", (code) => {
    if (loginProcess === child) loginProcess = null;
    sendText(config.telegramChatId, code === 0
      ? "✅ Đã lưu phiên đăng nhập IUH mới. Bộ theo dõi sẽ tự tiếp tục, không cần khởi động lại."
      : "❌ Chưa lưu được phiên IUH. Gửi /dangnhap để thử lại và hoàn tất đăng nhập trong vòng 15 phút.")
      .catch(console.error);
  });

  return "🔐 Đã mở Chrome trên máy đang chạy bot. Hãy đăng nhập IUH và nhập CAPTCHA; bot sẽ nhắn lại khi lưu phiên xong.";
}

function publicHelp() {
  return [
    "/start — Đăng ký nhận thông báo",
    "/status — Tình trạng theo dõi",
    "/events — Danh sách hoạt động gần nhất",
    "/stop — Hủy nhận thông báo",
    "/help — Hướng dẫn",
  ].join("\n");
}

async function replyFor(message) {
  const { text, chat, from = {} } = message;
  const command = text.trim().split(/\s/u)[0].split("@")[0].toLowerCase();
  const chatId = String(chat.id);
  const isAdmin = chatId === String(config.telegramChatId);

  if (command === "/start") {
    await subscribe(config.subscriberStatePath, {
      chatId,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
    const hasSession = await sessionExists();
    return [
      "✅ Bạn đã đăng ký nhận thông báo hoạt động điểm rèn luyện IUH.",
      "",
      isAdmin && !hasSession
        ? "Chưa có phiên IUH. Dùng /dangnhap để mở Chrome trên máy chủ và đăng nhập một lần."
        : hasSession
        ? "Đã có phiên IUH cục bộ. Dùng /status để xem lần kiểm tra hoạt động gần nhất."
        : "Chủ bot đang cần đăng nhập IUH. Bạn vẫn được lưu trong danh sách nhận thông báo.",
      "",
      publicHelp(),
      isAdmin ? "/dangnhap — Mở Chrome đăng nhập IUH\n/subscribers — Xem người đăng ký" : "",
    ].join("\n");
  }
  if (command === "/help") {
    return [
      "🤖 Bot thông báo hoạt động điểm rèn luyện IUH",
      "",
      publicHelp(),
      isAdmin ? "/dangnhap — Mở Chrome đăng nhập IUH\n/subscribers — Xem người đăng ký" : "",
    ].filter(Boolean).join("\n");
  }
  if (command === "/stop") {
    if (isAdmin) return "🛡️ Tài khoản chủ bot luôn nhận cảnh báo quản trị và sự kiện. Không thể hủy bằng /stop.";
    const removed = await unsubscribe(config.subscriberStatePath, chatId);
    return removed
      ? "🔕 Bạn đã hủy nhận thông báo. Gửi /start bất cứ lúc nào để đăng ký lại."
      : "Bạn chưa đăng ký nhận thông báo. Gửi /start để đăng ký.";
  }
  if (!isAdmin && !(await isSubscribed(config.subscriberStatePath, chatId))) {
    return "Bạn chưa đăng ký. Hãy gửi /start để bắt đầu nhận thông báo.";
  }
  if (command === "/status") {
    const state = await readJson(config.eventStatePath, null);
    if (!(await sessionExists())) {
      return isAdmin
        ? "🟡 Telegram đang hoạt động.\nGửi /dangnhap để mở Chrome trên máy và đăng nhập một lần. Bot sẽ tự tiếp tục theo dõi."
        : "🟡 Bot đang chờ chủ bot đăng nhập IUH.";
    }
    if (state?.authStatus === "required") {
      return isAdmin
        ? "🟡 Phiên IUH đã hết hạn.\nGửi /dangnhap để mở Chrome trên máy và đăng nhập lại. Bot sẽ tự dùng phiên mới; không cần khởi động lại."
        : "🟡 Phiên IUH đã hết hạn. Chủ bot đã được thông báo để đăng nhập lại.";
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
  if (command === "/dangnhap" || command === "/login") {
    if (!isAdmin) return "⛔ Lệnh /dangnhap chỉ dành cho chủ bot.";
    return triggerLogin();
  }
  if (command === "/subscribers") {
    if (!isAdmin) return "⛔ Lệnh này chỉ dành cho chủ bot.";
    const subscribers = await readSubscribers(config.subscriberStatePath);
    const members = subscribers.filter((item) => item.chatId !== String(config.telegramChatId));
    return [
      `👥 Người đăng ký: ${members.length}`,
      `Tổng người nhận kể cả chủ bot: ${members.length + 1}`,
      ...members.slice(-20).map((item, index) => {
        const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Không có tên";
        return `${index + 1}. ${name}${item.username ? ` (@${item.username})` : ""}`;
      }),
      members.length > 20 ? `Đang hiển thị 20/${members.length} người gần nhất.` : "",
    ].filter(Boolean).join("\n");
  }
  return `Lệnh chưa được hỗ trợ.\n\n${publicHelp()}`;
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
    await telegram("setMyCommands", {
      commands: [
        { command: "start", description: "Đăng ký nhận thông báo" },
        { command: "status", description: "Kiểm tra trạng thái theo dõi" },
        { command: "events", description: "Xem hoạt động gần nhất" },
        { command: "stop", description: "Hủy nhận thông báo" },
        { command: "help", description: "Xem hướng dẫn sử dụng" },
      ],
    });
    await telegram("setMyCommands", {
      scope: { type: "chat", chat_id: config.telegramChatId },
      commands: [
        { command: "start", description: "Đăng ký và xem hướng dẫn" },
        { command: "status", description: "Kiểm tra trạng thái theo dõi" },
        { command: "events", description: "Xem hoạt động gần nhất" },
        { command: "dangnhap", description: "Mở Chrome đăng nhập lại IUH" },
        { command: "subscribers", description: "Xem số người đăng ký" },
        { command: "help", description: "Xem hướng dẫn sử dụng" },
      ],
    });
    await telegram("setChatMenuButton", {
      menu_button: { type: "commands" },
    });
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
          if (message?.chat?.type === "private" && message.text) {
            await telegram("sendMessage", {
              chat_id: message.chat.id,
              text: await replyFor(message),
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
