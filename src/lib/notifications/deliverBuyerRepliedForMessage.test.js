/** @jest-environment node */

jest.mock("./deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

import { deliverNotificationQueueItemWithPush } from "./deliverNotificationsServer";
import { deliverBuyerRepliedNotificationForMessage } from "./deliverBuyerRepliedForMessage";

describe("deliverBuyerRepliedNotificationForMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("delivers pending buyer_replied queue row by message id", async () => {
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
                      data: [{ id: "queue-br-1", status: "pending", event_type: "buyer_replied" }],
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

    const result = await deliverBuyerRepliedNotificationForMessage(adminClient, {
      messageId: "msg-followup-1",
    });

    expect(result.path).toBe("queue_message");
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(adminClient, "queue-br-1");
  });

  test("delivers directly when queue id is provided", async () => {
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true });

    const result = await deliverBuyerRepliedNotificationForMessage(
      { from: jest.fn() },
      { queueId: "queue-explicit" }
    );

    expect(result.path).toBe("queue_id");
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(
      expect.anything(),
      "queue-explicit"
    );
  });

  test("skips when message id is missing", async () => {
    const result = await deliverBuyerRepliedNotificationForMessage({ from: jest.fn() }, {});

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("message_id_required");
    expect(deliverNotificationQueueItemWithPush).not.toHaveBeenCalled();
  });
});
