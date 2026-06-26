/** @jest-environment node */

import { resolveInboxGroupId, CRM_PIPELINE_STAGE, INQUIRY_STATUS } from "./crmConstants";
import { enqueueNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications/notificationEvents";

describe("crmConstants", () => {
  test("resolveInboxGroupId maps pipeline stages", () => {
    expect(resolveInboxGroupId({ pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY })).toBe("new");
    expect(resolveInboxGroupId({ pipeline_stage: CRM_PIPELINE_STAGE.VIEWING_SCHEDULED })).toBe(
      "viewing_scheduled"
    );
    expect(resolveInboxGroupId({ pipeline_stage: CRM_PIPELINE_STAGE.ARCHIVED })).toBe("archived");
    expect(resolveInboxGroupId({ inquiry_status: INQUIRY_STATUS.NEW })).toBe("new");
  });
});

describe("notificationEvents", () => {
  test("enqueueNotificationEvent skips gracefully when table missing", async () => {
    const client = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              error: { message: "relation notification_queue does not exist" },
            }),
          }),
        }),
      }),
    };
    const result = await enqueueNotificationEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      recipientId: "agent-1",
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test("enqueueNotificationEvent inserts pending row", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "q1" }, error: null }),
      }),
    });
    const client = { from: jest.fn().mockReturnValue({ insert }) };
    const result = await enqueueNotificationEvent(client, {
      eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
      recipientId: "buyer-1",
      payload: { viewing_id: "v1" },
    });
    expect(result.ok).toBe(true);
    expect(result.queueId).toBe("q1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "viewing_confirmed", status: "pending" })
    );
  });
});
