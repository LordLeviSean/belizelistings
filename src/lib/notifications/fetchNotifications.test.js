/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

import { fetchNotifications, fetchUnreadNotificationCount, mapNotificationsForCenter } from "./fetchNotifications";

describe("fetchNotifications", () => {
  test("fetchNotifications returns rows when table exists", async () => {
    const rows = [
      {
        id: "n1",
        event_type: "new_inquiry",
        category: "inquiry",
        title: "New inquiry",
        body: "Body",
        payload: {},
        read_at: null,
        created_at: "2026-06-27T12:00:00.000Z",
      },
    ];
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await fetchNotifications(client, "user-1", { limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.skipped).toBeUndefined();
  });

  test("fetchUnreadNotificationCount uses head count", async () => {
    const client = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        }),
      }),
    };

    const result = await fetchUnreadNotificationCount(client, "user-1");
    expect(result.count).toBe(3);
  });

  test("mapNotificationsForCenter shapes items", () => {
    const items = mapNotificationsForCenter([
      {
        id: "n1",
        event_type: "new_inquiry",
        category: "inquiry",
        title: "New inquiry on your listing",
        body: "Note",
        payload: { inquiry_id: "i1" },
        read_at: null,
        created_at: "2026-06-27T12:00:00.000Z",
      },
    ]);
    expect(items[0].unread).toBe(true);
    expect(items[0].href).toBe("/dashboard/agent?tab=inbox");
  });
});
