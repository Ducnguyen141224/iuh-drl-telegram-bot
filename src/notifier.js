import { createTelegramClient } from "./telegram-api.js";

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

async function postJson(url, body, label) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error(`Không kết nối được ${label}.`); }
  if (!response.ok) {
    throw new Error(`${label} trả về HTTP ${response.status}.`);
  }
}

export function createNotifier(config) {
  const hasTelegram = Boolean(config.telegramBotToken && config.telegramChatId);
  const hasDiscord = Boolean(config.discordWebhookUrl);
  const telegram = createTelegramClient(config.telegramBotToken);

  return {
    hasRemoteChannel: hasTelegram || hasDiscord,

    async send(message) {
      console.log(`\n${message}\n`);
      const jobs = [];

      if (hasTelegram) {
        jobs.push(
          telegram(
            "sendMessage",
            {
              chat_id: config.telegramChatId,
              text: truncate(message, 4096),
              disable_web_page_preview: true,
            },
          ),
        );
      }

      if (hasDiscord) {
        jobs.push(
          postJson(
            config.discordWebhookUrl,
            {
              content: truncate(message, 2000),
              allowed_mentions: { parse: [] },
            },
            "Discord",
          ),
        );
      }

      const results = await Promise.allSettled(jobs);
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          `Không gửi được thông báo: ${failures.map((failure) => failure.reason.message).join("; ")}`,
        );
      }
    },
  };
}
