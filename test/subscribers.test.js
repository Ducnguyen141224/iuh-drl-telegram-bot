import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  isSubscribed,
  notificationChatIds,
  readSubscribers,
  subscribe,
  unsubscribe,
} from "../src/subscribers.js";

test("đăng ký, cập nhật và hủy người nhận Telegram", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "iuh-subscribers-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "subscribers.json");

  const first = await subscribe(file, { chatId: 100, username: "alice", firstName: "A" }, "2026-01-01T00:00:00Z");
  assert.equal(first.created, true);
  assert.equal(await isSubscribed(file, "100"), true);

  const updated = await subscribe(file, { chatId: "100", username: "alice_new", firstName: "Alice" }, "2026-01-02T00:00:00Z");
  assert.equal(updated.created, false);
  const records = await readSubscribers(file);
  assert.equal(records.length, 1);
  assert.equal(records[0].subscribedAt, "2026-01-01T00:00:00Z");
  assert.equal(records[0].username, "alice_new");

  assert.equal(await unsubscribe(file, 100), true);
  assert.equal(await unsubscribe(file, 100), false);
  assert.equal(await isSubscribed(file, 100), false);
});

test("danh sách nhận luôn chứa chủ bot và không trùng", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "iuh-recipients-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "subscribers.json");
  await subscribe(file, { chatId: "admin" });
  await subscribe(file, { chatId: "member" });
  assert.deepEqual(await notificationChatIds(file, "admin"), ["admin", "member"]);
});
