/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

import { deliverNotificationQueueItem, processNotificationQueueBatch } from "./deliverNotifications";

describe("deliverNotifications", () => {
  test("deliverNotificationQueueItem calls deliver_notification RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { ok: true, notification_id: "n1", dedupe_key: "new_inquiry:inq-1" },
      error: null,
    });
    const client = { rpc };

    const result = await deliverNotificationQueueItem(client, "q1");
    expect(rpc).toHaveBeenCalledWith("deliver_notification", { p_queue_id: "q1" });
    expect(result.ok).toBe(true);
    expect(result.data.email_channel).toBe("skipped");
  });

  test("deliverNotificationQueueItem skips when RPC missing", async () => {
    const result = await deliverNotificationQueueItem({}, "q1");
    expect(result.skipped).toBe(true);
  });

  test("processNotificationQueueBatch dedupe via batch RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { ok: true, processed: 1, failed: 0, results: [{ ok: true, dedupe_key: "x" }] },
      error: null,
    });
    const result = await processNotificationQueueBatch({ rpc }, { limit: 10 });
    expect(rpc).toHaveBeenCalledWith("process_notification_queue_batch", { p_limit: 10 });
    expect(result.ok).toBe(true);
    expect(result.data.processed).toBe(1);
  });
});
