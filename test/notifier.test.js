import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createNotifier } from "../src/notifier.js";
import { subscribe } from "../src/subscribers.js";

test("gửi sự kiện cho mọi thuê bao nhưng cảnh báo quản trị chỉ cho chủ bot", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "iuh-notifier-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const subscriberStatePath = path.join(directory, "subscribers.json");
  await subscribe(subscriberStatePath, { chatId: "member" });

  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };
  };

  const notifier = createNotifier({
    telegramBotToken: "test-token",
    telegramChatId: "admin",
    subscriberStatePath,
    discordWebhookUrl: "",
  });
  await notifier.send("Sự kiện mới");
  assert.deepEqual(calls.map((call) => call.chat_id), ["admin", "member"]);

  calls.length = 0;
  await notifier.sendAdmin("Phiên đăng nhập hết hạn");
  assert.deepEqual(calls.map((call) => call.chat_id), ["admin"]);
});

test("khi gửi lại không gửi trùng tới người đã nhận thành công", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "iuh-retry-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const subscriberStatePath = path.join(directory, "subscribers.json");
  await subscribe(subscriberStatePath, { chatId: "member" });

  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  let failMember = true;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.chat_id);
    if (body.chat_id === "member" && failMember) throw new Error("temporary network failure");
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };
  };

  const notifier = createNotifier({
    telegramBotToken: "test-token",
    telegramChatId: "admin",
    subscriberStatePath,
    discordWebhookUrl: "",
  });
  let deliveredTo = [];
  await assert.rejects(
    notifier.send("Sự kiện mới"),
    (error) => {
      deliveredTo = error.deliveredTo;
      return deliveredTo.includes("telegram:admin");
    },
  );

  calls.length = 0;
  failMember = false;
  await notifier.send("Sự kiện mới", { deliveredTo });
  assert.deepEqual(calls, ["member"]);
});
