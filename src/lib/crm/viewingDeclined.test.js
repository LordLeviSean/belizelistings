/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_VIEWING_PERSIST: true,
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "queue-declined-1" }),
  triggerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
  NOTIFICATION_EVENT_TYPES: {
    VIEWING_REQUESTED: "viewing_requested",
    VIEWING_CONFIRMED: "viewing_confirmed",
    VIEWING_DECLINED: "viewing_declined",
    VIEWING_CANCELLED: "viewing_cancelled",
    VIEWING_RESCHEDULED: "viewing_rescheduled",
    VIEWING_COMPLETED: "viewing_completed",
  },
}));

import { NOTIFICATION_EVENT_TYPES, enqueueNotificationEvent } from "../notifications/notificationEvents";
import { performDeclineViewing } from "./viewingMutations";
import { VIEWING_STATUS } from "./crmConstants";

function buildDeclineClient({
  updateResult = {
    data: {
      id: "view-1",
      listing_id: 5,
      conversation_id: "conv-1",
      requester_id: "buyer-1",
      agent_user_id: "agent-1",
      requested_date: "2026-07-15",
      requested_time: "10:00",
    },
    error: null,
  },
} = {}) {
  const chain = {
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(updateResult),
  };
  const update = jest.fn().mockReturnValue(chain);
  const client = {
    from: jest.fn((table) => {
      if (table === "viewing_requests") return { update };
      if (table === "conversation_messages") {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  return { client, update, chain };
}

describe("viewing_declined notification wiring", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("performDeclineViewing enqueues one viewing_declined notification for buyer after persist", async () => {
    const { client, update, chain } = buildDeclineClient();

    const result = await performDeclineViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(result.error).toBeNull();
    expect(result.queueId).toBe("queue-declined-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: VIEWING_STATUS.DECLINED })
    );
    expect(chain.eq).toHaveBeenCalledWith("status", VIEWING_STATUS.PENDING);
    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(1);
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED,
        recipientId: "buyer-1",
        payload: expect.objectContaining({
          viewing_id: "view-1",
          requested_date: "2026-07-15",
          requested_time: "10:00",
          dedupe_key: "viewing_declined:view-1:buyer-1",
          recipient_user_id: "buyer-1",
        }),
      }),
      { deliver: false }
    );
  });

  test("failed decline does not enqueue viewing_declined", async () => {
    const { client } = buildDeclineClient({
      updateResult: { data: null, error: { message: "not found" } },
    });

    const result = await performDeclineViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(result.error).toEqual({ message: "not found" });
    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  test("already-declined viewing does not enqueue another notification", async () => {
    const { client } = buildDeclineClient({
      updateResult: { data: null, error: { code: "PGRST116", message: "0 rows" } },
    });

    const result = await performDeclineViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(result.error).toBeTruthy();
    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  test("declining user does not self-notify when requester matches agent", async () => {
    const { client } = buildDeclineClient({
      updateResult: {
        data: {
          id: "view-1",
          listing_id: 5,
          conversation_id: null,
          requester_id: "agent-1",
          agent_user_id: "agent-1",
          requested_date: "2026-07-15",
          requested_time: "10:00",
        },
        error: null,
      },
    });

    await performDeclineViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });
});
