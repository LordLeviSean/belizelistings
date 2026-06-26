/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

import { enqueueNotificationEvent, NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

jest.mock("./deliverNotifications", () => ({
  deliverAfterEnqueue: jest.fn().mockResolvedValue({ ok: true, data: { notification_id: "n1" } }),
}));

import { deliverAfterEnqueue } from "./deliverNotifications";

describe("notificationEvents integration", () => {
  test("enqueue → deliver path when flag on", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "queue-1" }, error: null }),
      }),
    });
    const client = { from: jest.fn().mockReturnValue({ insert }) };

    const result = await enqueueNotificationEvent(
      client,
      {
        eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
        recipientId: "agent-1",
        payload: { inquiry_id: "inq-1" },
      },
      { deliver: true }
    );

    expect(result.ok).toBe(true);
    expect(result.queueId).toBe("queue-1");
    expect(deliverAfterEnqueue).toHaveBeenCalledWith(client, "queue-1");
    expect(result.delivery?.ok).toBe(true);
  });
});
