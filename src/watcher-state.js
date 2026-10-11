import { diffEvents, eventMap } from "./core.js";

export function applyObservation(previous, events, options, now = new Date().toISOString()) {
  const history = previous.history || previous.events || {};
  const notifications = diffEvents(history, events, {
    ...options,
    hasBaseline: previous.initialized === true || Object.keys(history).length > 0,
  });
  let sequence = previous.sequence || 0;
  const pendingNotifications = [
    ...(previous.pendingNotifications || []),
    ...notifications.map((notice) => ({
      ...notice,
      key: `${notice.type}:${notice.event.id}:${++sequence}`,
      createdAt: now,
    })),
  ];
  return {
    ...previous,
    events: eventMap(events),
    history: { ...history, ...eventMap(events) },
    initialized: true,
    checkedAt: now,
    attemptedAt: now,
    authStatus: "ready",
    lastError: "",
    lastAlertedError: "",
    pendingNotifications,
    sequence,
  };
}
