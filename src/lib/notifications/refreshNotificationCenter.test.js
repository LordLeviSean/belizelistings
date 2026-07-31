/** @jest-environment node */

import {
  applyDurableNotificationRefresh,
  buildNotificationCenterItems,
  fetchDurableInboxForNotificationCenter,
  reconcileNotificationCenterAfterRefresh,
} from "./refreshNotificationCenter";
import { fetchNotifications, fetchUnreadNotificationCount } from "./fetchNotifications";
import { mergeNotificationCenterItems } from "./notificationCenterQuery";

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("./fetchNotifications", () => ({
  fetchNotifications: jest.fn(),
  fetchUnreadNotificationCount: jest.fn(),
  mapNotificationsForCenter: jest.fn((rows) =>
    rows.map((row) => ({
      id: `notif-${row.id}`,
      notificationId: String(row.id),
      when: row.created_at,
      unread: !row.read_at,
      href: row.href || "/dashboard/user",
      title: row.title || "Update",
      detail: row.body || "",
      category: row.category || "guidance",
    }))
  ),
}));

describe("refreshNotificationCenter", () => {
  beforeEach(() => {
    fetchNotifications.mockReset();
    fetchUnreadNotificationCount.mockReset();
  });

  test("fetchDurableInboxForNotificationCenter returns newest eligible rows", async () => {
    fetchNotifications.mockResolvedValue({
      data: [{ id: "2", created_at: "2026-07-24T12:00:00.000Z", read_at: null }],
      skipped: false,
      error: null,
    });
    fetchUnreadNotificationCount.mockResolvedValue({ count: 1, skipped: false });

    const result = await fetchDurableInboxForNotificationCenter({}, "user-1");
    expect(result.durableItems[0].notificationId).toBe("2");
    expect(result.unreadCount).toBe(1);
    expect(fetchNotifications).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.objectContaining({ dropdownRetentionHours: 24 })
    );
  });

  test("buildNotificationCenterItems keeps durable inbox first", () => {
    const merged = buildNotificationCenterItems({
      durableItems: [{ id: "notif-1", notificationId: "1", sortAt: "2026-07-24T12:00:00.000Z" }],
      supplementalItems: [{ id: "sum-pending", unread: true }],
      formatWhen: () => "12m ago",
    });
    expect(merged[0].id).toBe("notif-1");
    expect(merged[1].id).toBe("sum-pending");
  });

  test("realtime notification plus refresh is deduplicated", () => {
    const fetched = mergeNotificationCenterItems({
      durableItems: [{ id: "notif-1", notificationId: "1", when: "2026-07-24T12:00:00.000Z" }],
      supplementalItems: [],
      limit: 10,
    });
    const existing = [{ id: "notif-1", notificationId: "1", when: "Just now", unread: true }];
    expect(
      reconcileNotificationCenterAfterRefresh(existing, fetched).map((item) => item.id)
    ).toEqual(["notif-1"]);
  });

  test("refresh preserves optimistic read state", () => {
    const next = [{ id: "notif-1", notificationId: "1", unread: true }];
    const previous = [
      { id: "notif-1", notificationId: "1", unread: false, readAt: "2026-07-24T12:00:00.000Z" },
    ];
    const reconciled = reconcileNotificationCenterAfterRefresh(previous, next);
    expect(reconciled[0].unread).toBe(false);
    expect(reconciled[0].readAt).toBe("2026-07-24T12:00:00.000Z");
  });

  test("fetch failure returns error without throwing", async () => {
    fetchNotifications.mockResolvedValue({
      data: [],
      skipped: false,
      error: { message: "boom" },
    });
    fetchUnreadNotificationCount.mockResolvedValue({ count: 0, skipped: false });
    const result = await fetchDurableInboxForNotificationCenter({}, "user-1");
    expect(result.error).toBeTruthy();
    expect(result.durableItems).toEqual([]);
    expect(result.unreadReliable).toBe(false);
  });

  test("stale server unread zero cannot clear a realtime unread arrival during refresh", () => {
    const applied = applyDurableNotificationRefresh({
      previousItems: [
        { id: "notif-new", notificationId: "new", unread: true, when: "Just now" },
      ],
      durableItems: [],
      supplementalItems: [],
      serverUnreadCount: 0,
      serverCountReliable: true,
      previousUnreadCount: 1,
      limit: 10,
      formatWhen: (iso) => iso,
    });
    expect(applied.items.some((item) => item.id === "notif-new")).toBe(true);
    expect(applied.unreadCount).toBeGreaterThanOrEqual(1);
  });

  test("unread count error falls back to local durable unread", async () => {
    fetchNotifications.mockResolvedValue({
      data: [{ id: "2", created_at: "2026-07-24T12:00:00.000Z", read_at: null }],
      skipped: false,
      error: null,
    });
    fetchUnreadNotificationCount.mockResolvedValue({ count: 0, skipped: false, error: { message: "count failed" } });

    const result = await fetchDurableInboxForNotificationCenter({}, "user-1");
    expect(result.unreadReliable).toBe(false);
    expect(result.unreadCount).toBe(1);
  });

  test("reading one item during refresh stays read and does not resurrect unread", () => {
    const applied = applyDurableNotificationRefresh({
      previousItems: [
        {
          id: "notif-1",
          notificationId: "1",
          unread: false,
          readAt: "2026-07-24T12:00:00.000Z",
        },
      ],
      durableItems: [
        {
          id: "notif-1",
          notificationId: "1",
          sortAt: "2026-07-24T11:00:00.000Z",
          when: "2026-07-24T11:00:00.000Z",
          unread: true,
        },
      ],
      serverUnreadCount: 1,
      serverCountReliable: true,
      previousUnreadCount: 0,
      formatWhen: () => "12m ago",
    });
    expect(applied.items[0].unread).toBe(false);
    expect(applied.items[0].readAt).toBe("2026-07-24T12:00:00.000Z");
  });
});
