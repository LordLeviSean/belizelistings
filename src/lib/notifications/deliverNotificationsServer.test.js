/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../push/deliverNewInquiryWebPush", () => ({
  maybeDeliverNewInquiryWebPush: jest.fn().mockResolvedValue({ ok: true, skipped: true }),
}));

jest.mock("./deliverNotifications", () => ({
  deliverNotificationQueueItem: jest.fn(),
  processNotificationQueueBatch: jest.fn(),
}));

import { maybeDeliverNewInquiryWebPush } from "../push/deliverNewInquiryWebPush";
import {
  deliverNotificationQueueItem,
  processNotificationQueueBatch,
} from "./deliverNotifications";
import {
  deliverNotificationQueueItemWithPush,
  processNotificationQueueBatchWithPush,
} from "./deliverNotificationsServer";

describe("deliverNotificationsServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deliverNotificationQueueItemWithPush attaches new_inquiry push after inbox delivery", async () => {
    const client = { rpc: jest.fn() };
    deliverNotificationQueueItem.mockResolvedValue({
      ok: true,
      skipped: false,
      data: {
        ok: true,
        event_type: "new_inquiry",
        recipient_id: "agent-1",
        notification_id: "notif-1",
        dedupe_key: "new_inquiry:inq-1",
      },
    });

    await deliverNotificationQueueItemWithPush(client, "q1");

    expect(maybeDeliverNewInquiryWebPush).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        event_type: "new_inquiry",
        recipient_id: "agent-1",
      })
    );
  });

  test("processNotificationQueueBatchWithPush fans out push delivery for batch results", async () => {
    const client = { rpc: jest.fn() };
    processNotificationQueueBatch.mockResolvedValue({
      ok: true,
      data: {
        processed: 1,
        results: [
          {
            ok: true,
            event_type: "new_inquiry",
            recipient_id: "agent-1",
            notification_id: "notif-1",
          },
        ],
      },
    });

    await processNotificationQueueBatchWithPush(client, { limit: 5 });

    expect(maybeDeliverNewInquiryWebPush).toHaveBeenCalledTimes(1);
  });
});
