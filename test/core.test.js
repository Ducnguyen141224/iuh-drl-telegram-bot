import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanEventName,
  diffEvents,
  normalizeEvent,
  parseCapacity,
} from "../src/core.js";

test("tách sức chứa khỏi tên hoạt động", () => {
  assert.deepEqual(parseCapacity("Hoạt động A (12/50)"), {
    registered: 12,
    limit: 50,
  });
  assert.equal(cleanEventName("Hoạt động A (12/50)"), "Hoạt động A");
});

test("ID từ modal không đổi khi số lượng thay đổi", () => {
  const first = normalizeEvent({
    id: "4188",
    name: "Hoạt động A (12/50)",
    status: "Đăng ký",
    hasRegistrationControl: true,
  });
  const later = normalizeEvent({
    id: "4188",
    name: "Hoạt động A (49/50)",
    status: "Đăng ký",
    hasRegistrationControl: true,
  });
  assert.equal(first.id, later.id);
});

test("lần đầu chỉ tạo mốc, không gửi thông báo mặc định", () => {
  const event = normalizeEvent({ id: "1", name: "Mới" });
  assert.deepEqual(diffEvents({}, [event], { hasBaseline: false }), []);
});

test("không bỏ sót hoạt động đầu tiên sau một mốc rỗng", () => {
  const event = normalizeEvent({ id: "1", name: "Mới" });
  const notices = diffEvents({}, [event], { hasBaseline: true });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].type, "new");
});

test("phát hiện hoạt động mới sau khi đã có mốc", () => {
  const oldEvent = normalizeEvent({ id: "1", name: "Cũ" });
  const newEvent = normalizeEvent({ id: "2", name: "Mới" });
  const notices = diffEvents({ 1: oldEvent }, [oldEvent, newEvent]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].type, "new");
  assert.equal(notices[0].event.id, "2");
});

test("phát hiện hoạt động mở lại đăng ký", () => {
  const closed = normalizeEvent({
    id: "1",
    name: "Hoạt động A (50/50)",
    status: "Đã đủ số lượng",
    hasRegistrationControl: false,
  });
  const opened = normalizeEvent({
    id: "1",
    name: "Hoạt động A (49/50)",
    status: "Đăng ký",
    hasRegistrationControl: true,
  });
  const notices = diffEvents({ 1: closed }, [opened]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].type, "reopened");
});
