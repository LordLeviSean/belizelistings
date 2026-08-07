/** @jest-environment node */

jest.mock("./deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

jest.mock("../push/deliverNewInquiryWebPush", () => ({
  deliverNewInquiryWebPush: jest.fn(),
}));

import { deliverNotificationQueueItemWithPush } from "./deliverNotificationsServer";
import { deliverNewInquiryWebPush } from "../push/deliverNewInquiryWebPush";
import { deliverNewInquiryNotificationForInquiry } from "./deliverNewInquiryForInquiry";

describe("deliverNewInquiryNotificationForInquiry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("delivers pending queue row by inquiry id", async () => {
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true, data: { ok: true } });

    const adminClient = {
      from: jest.fn((table) => {
        if (table === "notification_queue") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                contains: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                      data: [{ id: "queue-1", status: "pending", event_type: "new_inquiry" }],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const result = await deliverNewInquiryNotificationForInquiry(adminClient, {
      inquiryId: "inq-1",
    });

    expect(result.path).toBe("queue_inquiry");
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(adminClient, "queue-1");
  });

  test("push-only path uses durable notification identity", async () => {
    deliverNewInquiryWebPush.mockResolvedValue({ ok: true, deliveryStatus: "delivered" });

    const adminClient = {
      from: jest.fn((table) => {
        if (table === "notification_queue") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                contains: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "notifications") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: "notif-1",
                        recipient_user_id: "agent-1",
                        dedupe_key: "new_inquiry:inq-1",
                        event_type: "new_inquiry",
                        payload: { inquiry_id: "inq-1", conversation_id: "conv-1" },
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const result = await deliverNewInquiryNotificationForInquiry(adminClient, {
      inquiryId: "inq-1",
    });

    expect(result.path).toBe("notification_push_only");
    expect(deliverNewInquiryWebPush).toHaveBeenCalledWith(
      adminClient,
      expect.objectContaining({
        notification_id: "notif-1",
        recipient_id: "agent-1",
        dedupe_key: "new_inquiry:inq-1",
      })
    );
  });
});
