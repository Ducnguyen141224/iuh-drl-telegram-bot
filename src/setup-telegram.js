import { config } from "./config.js";
import { createTelegramClient } from "./telegram-api.js";
import fs from "node:fs/promises";

const telegram = createTelegramClient(config.telegramBotToken);

try {
  if (!config.telegramBotToken) {
    throw new Error("Chưa có TELEGRAM_BOT_TOKEN trong .env.");
  }
  const bot = await telegram("getMe");
  console.log(`Token hợp lệ. Bot: @${bot.username}`);
  let chatId = config.telegramChatId;

  if (!chatId) {
    const webhook = await telegram("getWebhookInfo");
    if (webhook.url) {
      throw new Error("Bot đang có webhook. Cần lấy chat ID từ ứng dụng đang nhận webhook.");
    }
    // Omitting offset leaves incoming updates unacknowledged during discovery.
    const updates = await telegram("getUpdates", { limit: 100, timeout: 0 });
    const chats = new Map();
    for (const update of updates) {
      const chat = update.message?.chat;
      if (chat?.type === "private") chats.set(String(chat.id), chat);
    }
    if (chats.size === 0) {
      throw new Error("Chưa thấy tin nhắn riêng. Hãy mở đúng bot và gửi /start rồi thử lại.");
    }
    if (chats.size !== 1) {
      throw new Error("Có nhiều chat riêng đã nhắn bot; cần chọn TELEGRAM_CHAT_ID trước khi gửi thử.");
    }
    chatId = [...chats.keys()][0];
  }

  if (process.argv.includes("--save-chat-id")) {
    const envPath = ".env";
    const contents = await fs.readFile(envPath, "utf8");
    const pattern = /^[ \t]*TELEGRAM_CHAT_ID[ \t]*=[^\r\n]*/gm;
    const updated = pattern.test(contents)
      ? contents.replace(pattern, `TELEGRAM_CHAT_ID=${chatId}`)
      : `${contents.trimEnd()}\nTELEGRAM_CHAT_ID=${chatId}\n`;
    await fs.writeFile(envPath, updated, { mode: 0o600 });
    console.log("Đã lưu chat ID vào .env cục bộ.");
  }

  if (process.argv.includes("--send-test")) {
    const message = await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "✅ Đã kết nối bot thông báo điểm rèn luyện IUH với Telegram.\n\n" +
        "Đây là tin kiểm tra kết nối. Bước tiếp theo: đăng nhập IUH để bật theo dõi hoạt động.",
    });
    console.log(JSON.stringify({
      ok: true,
      botUsername: bot.username,
      chatId,
      testMessageId: message.message_id,
    }));
  } else {
    console.log(JSON.stringify({ ok: true, botUsername: bot.username, chatId }));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
