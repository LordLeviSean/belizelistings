/** @jest-environment node */

import {
  buildNotificationDropdownRetentionCutoffIso,
  compareNotificationCenterItems,
  mergeNotificationCenterItems,
  patchNotificationCenterItemRead,
  prependDurableNotificationItem,
} from "./notificationCenterQuery";

describe("notificationCenterQuery", () => {
  test("newest notification appears first", () => {
    const merged = mergeNotificationCenterItems({
      durableItems: [
        { id: "notif-a", notificationId: "a", when: "2026-07-24T10:00:00.000Z", unread: true },
        { id: "notif-b", notificationId: "b", when: "2026-07-24T12:00:00.000Z", unread: true },
      ],
      supplementalItems: [],
      limit: 10,
    });
    expect(merged[0].notificationId).toBe("b");
  });

  test("stable ordering when timestamps match", () => {
    const ts = "2026-07-24T12:00:00.000Z";
    expect(
      compareNotificationCenterItems(
        { id: "notif-2", notificationId: "2", when: ts },
        { id: "notif-10", notificationId: "10", when: ts }
      )
    ).toBeGreaterThan(0);
  });

  test("realtime prepend does not duplicate existing notification", () => {
    const existing = [{ id: "notif-1", notificationId: "1", unread: true }];
    const incoming = { id: "notif-1", notificationId: "1", unread: true, when: "now" };
    expect(prependDurableNotificationItem(existing, incoming, 10)).toEqual([incoming]);
  });

  test("read patch clears highlight without restarting read timer field", () => {
    const readAt = "2026-07-24T12:00:00.000Z";
    const next = patchNotificationCenterItemRead(
      [{ id: "notif-1", notificationId: "1", unread: true }],
      "1",
      readAt
    );
    expect(next[0].unread).toBe(false);
    expect(next[0].readAt).toBe(readAt);
  });

  test("retention cutoff uses 24 hour window", () => {
    const now = Date.parse("2026-07-24T12:00:00.000Z");
    expect(buildNotificationDropdownRetentionCutoffIso(now)).toBe("2026-07-23T12:00:00.000Z");
  });

  test("supplemental items follow durable inbox ordering", () => {
    const merged = mergeNotificationCenterItems({
      durableItems: [{ id: "notif-1", notificationId: "1", when: "2026-07-24T12:00:00.000Z" }],
      supplementalItems: [{ id: "sum-pending", when: "", unread: true }],
      limit: 10,
    });
    expect(merged[0].id).toBe("notif-1");
    expect(merged[1].id).toBe("sum-pending");
  });
});
