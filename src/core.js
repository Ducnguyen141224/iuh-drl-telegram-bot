import crypto from "node:crypto";

export function parseCapacity(name) {
  const match = name.match(/\((\d+)\s*\/\s*(\d+)\)\s*$/u);
  if (!match) return null;
  return { registered: Number(match[1]), limit: Number(match[2]) };
}

export function cleanEventName(name) {
  return name.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/u, "").trim();
}

export function stableEventId(raw) {
  if (raw.id) return String(raw.id);
  return crypto
    .createHash("sha256")
    .update([raw.name, raw.semester, raw.deadline].join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}

export function normalizeEvent(raw) {
  const name = cleanEventName(raw.name || "");
  const status = (raw.status || "").trim();
  const normalizedStatus = status.toLocaleLowerCase("vi-VN");
  const blocked = [
    "đã đủ số lượng",
    "hết số lượng",
    "hết hạn",
    "đã kết thúc",
    "đã đăng ký",
  ].some((word) => normalizedStatus.includes(word));

  const event = {
    id: stableEventId({ ...raw, name }),
    name,
    capacity: parseCapacity(raw.name || ""),
    semester: (raw.semester || "").trim(),
    points: (raw.points || "").trim(),
    deadline: (raw.deadline || "").trim(),
    status,
    details: (raw.details || "").replace(/\s+/gu, " ").trim(),
    canRegister:
      Boolean(raw.hasRegistrationControl || /đăng ký|tham gia/iu.test(status)) &&
      !blocked,
  };

  return event;
}

export function diffEvents(previousEvents, currentEvents, options = {}) {
  const previousById = new Map(
    Object.values(previousEvents || {}).map((event) => [event.id, event]),
  );
  const hasBaseline = options.hasBaseline ?? previousById.size > 0;
  const notifyOnFirstRun = options.notifyOnFirstRun === true;
  const notifyOnReopen = options.notifyOnReopen !== false;
  const notifications = [];

  for (const event of currentEvents) {
    const previous = previousById.get(event.id);
    if (!previous) {
      if (hasBaseline || notifyOnFirstRun) {
        notifications.push({ type: "new", event });
      }
      continue;
    }

    if (notifyOnReopen && !previous.canRegister && event.canRegister) {
      notifications.push({ type: "reopened", event });
    }
  }

  return notifications;
}

export function eventMap(events) {
  return Object.fromEntries(events.map((event) => [event.id, event]));
}

export function formatNotification(notification, url) {
  const { event, type } = notification;
  const heading =
    type === "reopened"
      ? "🔔 Hoạt động IUH vừa mở lại đăng ký"
      : "🎯 Hoạt động điểm rèn luyện IUH mới";
  const capacity = event.capacity
    ? `${event.capacity.registered}/${event.capacity.limit}`
    : "Không hiển thị";

  return [
    heading,
    "",
    event.name,
    `Điểm: ${event.points || "Chưa rõ"}`,
    `Học kỳ: ${event.semester || "Chưa rõ"}`,
    `Hạn đăng ký: ${event.deadline || "Chưa rõ"}`,
    `Số lượng: ${capacity}`,
    `Trạng thái: ${event.status || "Chưa rõ"}`,
    event.details ? `Chi tiết: ${event.details}` : "",
    `Mở trang: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}
