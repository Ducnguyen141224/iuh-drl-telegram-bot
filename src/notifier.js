import { createTelegramClient } from "./telegram-api.js";
import { notificationChatIds, unsubscribe } from "./subscribers.js";

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

    async send(message, options = {}) {
      console.log(`\n${message}\n`);
      const jobs = [];
      const delivered = new Set(options.deliveredTo || []);

      if (hasTelegram) {
        const chatIds = options.audience === "admin"
          ? [String(config.telegramChatId)]
          : await notificationChatIds(config.subscriberStatePath, config.telegramChatId);
        for (const chatId of chatIds) {
          const key = `telegram:${chatId}`;
          if (delivered.has(key)) continue;
          jobs.push({
            key,
            chatId,
            promise: telegram("sendMessage", {
              chat_id: chatId,
              text: truncate(message, 4096),
              disable_web_page_preview: true,
            }),
          });
        }
      }

      if (hasDiscord && !delivered.has("discord")) {
        jobs.push({
          key: "discord",
          promise: postJson(
            config.discordWebhookUrl,
            {
              content: truncate(message, 2000),
              allowed_mentions: { parse: [] },
            },
            "Discord",
          ),
        });
      }

      const results = await Promise.allSettled(jobs.map((job) => job.promise));
      const failures = [];
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const job = jobs[index];
        if (result.status === "fulfilled") {
          delivered.add(job.key);
          continue;
        }
        const isDeadSubscriber = job.chatId && job.chatId !== String(config.telegramChatId) &&
          [400, 403].includes(result.reason?.errorCode);
        if (isDeadSubscriber) {
          await unsubscribe(config.subscriberStatePath, job.chatId);
          continue;
        }
        failures.push(result.reason);
      }
      if (failures.length) {
        const error = new AggregateError(failures, `Không gửi được thông báo: ${failures.map((failure) => failure.message).join("; ")}`);
        error.deliveredTo = [...delivered];
        throw error;
      }
      return { deliveredTo: [...delivered] };
    },

    async sendAdmin(message) {
      return this.send(message, { audience: "admin" });
    },
  };
}
