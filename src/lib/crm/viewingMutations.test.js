/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_VIEWING_PERSIST: true,
  BL_ENABLE_NOTIFICATIONS: false,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "q1" }),
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

import { NOTIFICATION_EVENT_TYPES, enqueueNotificationEvent } from "../notifications/notificationEvents";
import {
  cancelViewing,
  confirmViewing,
  declineViewing,
  deleteViewing,
  markViewingCompleted,
  acceptViewingReschedule,
  performCreateViewingRequest,
} from "./viewingMutations";
import { VIEWING_STATUS } from "./crmConstants";

describe("viewingMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("performCreateViewingRequest inserts viewing_requests only and notifies owner", async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: "view-1" }, error: null });
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
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
        recipientId: "agent-1",
        payload: expect.objectContaining({
          viewing_id: "view-1",
          listing_title: "Finca Solana",
          dedupe_key: "viewing_requested:view-1:agent-1",
        }),
      }),
      { deliver: false }
    );
  });

  test("createViewingRequest rejects self-contact before insert", async () => {
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
  });

  test("confirmViewing emits public viewing_scheduled event", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "view-1",
          listing_id: 5,
          conversation_id: null,
          requester_id: "buyer-1",
          requested_date: "2026-07-01",
          requested_time: "10:00:00",
        },
        error: null,
      }),
    };
    const update = jest.fn().mockReturnValue(chain);
    const from = jest.fn((table) => {
      if (table === "viewing_requests") return { update };
      return { update };
    });
    const client = { from };

    const { error } = await confirmViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(error).toBeNull();
  });

  test("declineViewing sets declined status without requiring conversation", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "view-1", listing_id: 2, requester_id: "buyer-1", conversation_id: null },
        error: null,
      }),
    };
    const client = {
      from: jest.fn(() => ({
        update: jest.fn().mockReturnValue(chain),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: "q1" }, error: null }),
          }),
        }),
      })),
    };

    const { error } = await declineViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });
    expect(error).toBeNull();
  });

  test("cancelViewing notifies other participant", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "view-1",
          listing_id: 2,
          requester_id: "buyer-1",
          agent_user_id: "agent-1",
        },
        error: null,
      }),
    };
    const client = {
      from: jest.fn((table) => {
        if (table === "viewing_requests") return { update: jest.fn().mockReturnValue(chain) };
        return {};
      }),
    };

    const { error } = await cancelViewing(client, {
      viewingId: "view-1",
      actorUserId: "buyer-1",
      cancelledByAgent: false,
    });
    expect(error).toBeNull();
    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(2);
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED }),
      expect.any(Object)
    );
  });

  test("markViewingCompleted updates status and notifies both parties", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "view-1",
          status: VIEWING_STATUS.COMPLETED,
          listing_id: 2,
          requester_id: "buyer-1",
          agent_user_id: "agent-1",
          requested_date: "2026-07-15",
          requested_time: "08:00",
        },
        error: null,
      }),
    };
    const client = {
      from: jest.fn((table) => {
        if (table === "listings") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { title: "Finca" }, error: null }),
              }),
            }),
          };
        }
        return { update: jest.fn().mockReturnValue(chain) };
      }),
    };
    const { data, error } = await markViewingCompleted(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });
    expect(error).toBeNull();
    expect(data.status).toBe(VIEWING_STATUS.COMPLETED);
    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(2);
  });

  test("deleteViewing as agent only sets agent_deleted_at", async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "v1" }, error: null }),
      }),
    });
    const client = { from: jest.fn(() => ({ update })) };

    await deleteViewing(client, {
      viewingId: "v1",
      userId: "agent-1",
      asAgent: true,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ agent_deleted_at: expect.any(String) })
    );
  });
});
