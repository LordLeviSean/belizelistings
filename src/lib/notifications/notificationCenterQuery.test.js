/** @jest-environment node */

import {
  applyRealtimeUnreadInsert,
  applyRealtimeUnreadMarkRead,
  buildNotificationDropdownRetentionCutoffIso,
  compareNotificationCenterItems,
  mergeNotificationCenterItems,
  patchNotificationCenterItemRead,
  prefersReducedMotion,
  prependDurableNotificationItem,
  preserveMissedRealtimeUnreadArrivals,
  resolveUnreadNotificationBadgeCount,
  shouldTriggerNotificationArrivalAttention,
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

  test("realtime INSERT marks new unread for immediate badge increment", () => {
    const applied = applyRealtimeUnreadInsert(
      [],
      { id: "notif-9", notificationId: "9", unread: true, when: "2026-07-31T12:00:00.000Z" },
      { limit: 10 }
    );
    expect(applied.isNewUnread).toBe(true);
    expect(applied.items[0].id).toBe("notif-9");
  });

  test("duplicate realtime INSERT does not re-increment unread", () => {
    const existing = [{ id: "notif-9", notificationId: "9", unread: true }];
    const applied = applyRealtimeUnreadInsert(
      existing,
      { id: "notif-9", notificationId: "9", unread: true },
      { limit: 10 }
    );
    expect(applied.isNew).toBe(false);
    expect(applied.isNewUnread).toBe(false);
  });

  test("canonical unread count never hides local unread behind stale server zero", () => {
    expect(
      resolveUnreadNotificationBadgeCount({
        serverUnreadCount: 0,
        serverCountReliable: true,
        items: [{ id: "notif-1", unread: true }],
        previousCount: 1,
      })
    ).toBe(1);
  });

  test("canonical unread count prefers higher reliable server total", () => {
    expect(
      resolveUnreadNotificationBadgeCount({
        serverUnreadCount: 5,
        serverCountReliable: true,
        items: [{ id: "notif-1", unread: true }],
        previousCount: 1,
      })
    ).toBe(5);
  });

  test("unreliable server count preserves previous badge floor", () => {
    expect(
      resolveUnreadNotificationBadgeCount({
        serverUnreadCount: 0,
        serverCountReliable: false,
        items: [],
        previousCount: 2,
      })
    ).toBe(2);
  });

  test("badge disappears at zero when no unread remain", () => {
    expect(
      resolveUnreadNotificationBadgeCount({
        serverUnreadCount: 0,
        serverCountReliable: true,
        items: [{ id: "notif-1", unread: false }],
        previousCount: 0,
      })
    ).toBe(0);
  });

  test("mark-read decrements only when item was unread", () => {
    const unread = applyRealtimeUnreadMarkRead(
      [{ id: "notif-1", notificationId: "1", unread: true }],
      "1",
      "2026-07-31T12:00:00.000Z"
    );
    expect(unread.didMarkRead).toBe(true);
    expect(unread.items[0].unread).toBe(false);

    const alreadyRead = applyRealtimeUnreadMarkRead(
      [{ id: "notif-1", notificationId: "1", unread: false, readAt: "2026-07-31T11:00:00.000Z" }],
      "1",
      "2026-07-31T12:00:00.000Z"
    );
    expect(alreadyRead.didMarkRead).toBe(false);
  });

  test("refresh race preserves missed realtime unread arrival", () => {
    const previous = [
      { id: "notif-new", notificationId: "new", unread: true, when: "Just now" },
      { id: "notif-old", notificationId: "old", unread: false, when: "1h ago" },
    ];
    const next = [{ id: "notif-old", notificationId: "old", unread: false, when: "1h ago" }];
    const preserved = preserveMissedRealtimeUnreadArrivals(previous, next, { limit: 10 });
    expect(preserved[0].id).toBe("notif-new");
    expect(preserved.map((item) => item.id)).toEqual(["notif-new", "notif-old"]);
  });

  test("arrival attention triggers once per notification id", () => {
    const seen = new Set();
    expect(shouldTriggerNotificationArrivalAttention(seen, "abc")).toBe(true);
    expect(shouldTriggerNotificationArrivalAttention(seen, "abc")).toBe(false);
    expect(shouldTriggerNotificationArrivalAttention(seen, "def")).toBe(true);
  });

  test("prefersReducedMotion is callable", () => {
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });
});
