import path from "node:path";
import "dotenv/config";

function boolEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  url:
    process.env.IUH_URL ||
    "https://doantn.iuh.edu.vn/doanvien.html@211@Tra-cuu",
  authStatePath: path.resolve(
    process.env.IUH_AUTH_STATE || ".auth/iuh-storage-state.json",
  ),
  eventStatePath: path.resolve(
    process.env.EVENT_STATE_FILE || "data/events-state.json",
  ),
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "",
  pollIntervalMs: Math.max(60, numberEnv("POLL_INTERVAL_SECONDS", 60)) * 1000,
  headless: boolEnv("HEADLESS", true),
  notifyOnFirstRun: boolEnv("NOTIFY_ON_FIRST_RUN", false),
  notifyOnReopen: boolEnv("NOTIFY_ON_REOPEN", true),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
};
