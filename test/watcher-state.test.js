import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent } from "../src/core.js";
import { applyObservation } from "../src/watcher-state.js";

const event = (id, status = "Đăng ký") => normalizeEvent({ id, name: `Sự kiện ${id}`, status });

test("hoạt động biến mất rồi quay lại không báo mới lần hai", () => {
  const baseline = applyObservation({}, [event("1")], {});
  const absent = applyObservation(baseline, [], {});
  const returned = applyObservation(absent, [event("1")], {});
  assert.deepEqual(returned.pendingNotifications, []);
  assert.equal(Object.keys(returned.history).length, 1);
});

test("thông báo chưa gửi tồn tại qua restart và không tạo thêm bản trùng", () => {
  const baseline = applyObservation({}, [event("1")], {});
  const next = applyObservation(baseline, [event("1"), event("2")], {});
  const restored = JSON.parse(JSON.stringify(next));
  const checkedAgain = applyObservation(restored, [event("1"), event("2")], {});
  assert.equal(checkedAgain.pendingNotifications.length, 1);
  assert.equal(checkedAgain.pendingNotifications[0].event.id, "2");
});

test("mỗi lần đóng rồi mở lại có khóa thông báo riêng", () => {
  let state = applyObservation({}, [event("1", "Đã đủ số lượng")], {});
  state = applyObservation(state, [event("1")], {});
  const firstKey = state.pendingNotifications[0].key;
  state.pendingNotifications = [];
  state = applyObservation(state, [event("1", "Đã đủ số lượng")], {});
  state = applyObservation(state, [event("1")], {});
  assert.equal(state.pendingNotifications[0].type, "reopened");
  assert.notEqual(state.pendingNotifications[0].key, firstKey);
});
