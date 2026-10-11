import { readJson, writeJson } from "./storage.js";

function normalizeChatId(value) {
  return String(value ?? "").trim();
}

export async function readSubscribers(file) {
  const state = await readJson(file, { subscribers: [] });
  return Array.isArray(state.subscribers) ? state.subscribers : [];
}

export async function subscribe(file, user, now = new Date().toISOString()) {
  const chatId = normalizeChatId(user.chatId);
  if (!chatId) throw new Error("Chat ID không hợp lệ.");
  const subscribers = await readSubscribers(file);
  const existing = subscribers.find((item) => item.chatId === chatId);
  const record = {
    chatId,
    username: String(user.username || ""),
    firstName: String(user.firstName || ""),
    lastName: String(user.lastName || ""),
    subscribedAt: existing?.subscribedAt || now,
    updatedAt: now,
  };
  const next = [...subscribers.filter((item) => item.chatId !== chatId), record];
  await writeJson(file, { subscribers: next });
  return { created: !existing, subscriber: record };
}

export async function unsubscribe(file, chatId) {
  const normalized = normalizeChatId(chatId);
  const subscribers = await readSubscribers(file);
  const next = subscribers.filter((item) => item.chatId !== normalized);
  if (next.length !== subscribers.length) await writeJson(file, { subscribers: next });
  return next.length !== subscribers.length;
}

export async function isSubscribed(file, chatId) {
  const normalized = normalizeChatId(chatId);
  return (await readSubscribers(file)).some((item) => item.chatId === normalized);
}

export async function notificationChatIds(file, adminChatId) {
  const ids = (await readSubscribers(file)).map((item) => item.chatId);
  return [...new Set([normalizeChatId(adminChatId), ...ids].filter(Boolean))];
}
