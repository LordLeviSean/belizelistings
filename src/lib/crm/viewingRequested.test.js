/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "queue-view-1" }),
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

jest.mock("../notifications/triggerServerNotificationDelivery", () => ({
  triggerServerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

import { enqueueNotificationEvent } from "../notifications/notificationEvents";
import { triggerServerNotificationDelivery } from "../notifications/triggerServerNotificationDelivery";
import {
  createViewingRequest,
  performCreateViewingRequest,
} from "./viewingMutations";
import { VIEWING_STATUS } from "./crmConstants";

function buildInsertClient({ insertResult = { data: { id: "view-1" }, error: null } } = {}) {
  const single = jest.fn().mockResolvedValue(insertResult);
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  const client = {
    from: jest.fn((table) => {
      if (table === "viewing_requests") return { insert };
      if (table === "profiles") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  return { client, insert };
}

describe("viewing_requested notification wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("performCreateViewingRequest enqueues one viewing_requested notification after persist", async () => {
    const { client } = buildInsertClient();

    const result = await performCreateViewingRequest(client, {
      listingId: 12,
      agentUserId: "agent-1",
      requesterId: "buyer-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
      listingTitle: "Finca Solana",
      requesterName: "Alexis Marie",
    });

    expect(result.error).toBeNull();
    expect(result.queueId).toBe("queue-view-1");
    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(1);
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "viewing_requested",
        recipientId: "agent-1",
        payload: expect.objectContaining({
          viewing_id: "view-1",
          dedupe_key: "viewing_requested:view-1:agent-1",
          sender_name: "Alexis Marie",
          requested_date: "2026-07-15",
          requested_time: "08:00",
          recipient_role: "agent",
          recipient_side: "agent",
        }),
      }),
      { deliver: false }
    );
    expect(triggerServerNotificationDelivery).not.toHaveBeenCalled();
  });

  test("failed persistence does not enqueue viewing_requested", async () => {
    const { client } = buildInsertClient({
      insertResult: { data: null, error: { message: "insert failed" } },
    });

    const result = await performCreateViewingRequest(client, {
      listingId: 12,
      agentUserId: "agent-1",
      requesterId: "buyer-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
    });

    expect(result.error).toEqual({ message: "insert failed" });
    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  test("buyer self-contact is blocked before insert or notification", async () => {
    const client = { from: jest.fn() };
    const result = await performCreateViewingRequest(client, {
      listingId: 12,
      agentUserId: "owner-1",
      requesterId: "owner-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("self_viewing_not_allowed");
    expect(client.from).not.toHaveBeenCalled();
    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  test("owner recipient role stays user when listing contact is not an agent", async () => {
    const { client } = buildInsertClient();
    client.from = jest.fn((table) => {
      if (table === "viewing_requests") {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: "view-2" }, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { role: "user" }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    await performCreateViewingRequest(client, {
      listingId: 12,
      agentUserId: "owner-1",
      requesterId: "buyer-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        recipientId: "owner-1",
        payload: expect.objectContaining({
          recipient_role: "user",
          recipient_side: "owner",
        }),
      }),
      { deliver: false }
    );
  });

  test("createViewingRequest triggers immediate delivery on server after enqueue", async () => {
    const { client } = buildInsertClient();

    await createViewingRequest(client, {
      listingId: 12,
      agentUserId: "agent-1",
      requesterId: "buyer-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
    });

    expect(triggerServerNotificationDelivery).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ queueId: "queue-view-1" })
    );
  });
});

describe("viewingMutations legacy coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createViewingRequest inserts viewing_requests with pending status", async () => {
    const { client, insert } = buildInsertClient();

    const result = await performCreateViewingRequest(client, {
      listingId: 12,
      agentUserId: "agent-1",
      requestedDate: "2026-07-15",
      requestedTime: "08:00",
      listingTitle: "Finca Solana",
      requesterEmail: "buyer@test.com",
    });

    expect(result.error).toBeNull();
    expect(result.data.id).toBe("view-1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: null,
        status: VIEWING_STATUS.PENDING,
        requested_date: "2026-07-15",
        requested_time: "08:00",
      })
    );
  });
});
