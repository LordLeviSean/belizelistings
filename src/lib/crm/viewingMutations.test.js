/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_VIEWING_PERSIST: true,
  BL_ENABLE_NOTIFICATIONS: false,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("./inquiryMutations", () => ({
  createInquiryWithConversation: jest.fn(),
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
  },
}));

import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import { NOTIFICATION_EVENT_TYPES, enqueueNotificationEvent } from "../notifications/notificationEvents";
import { createInquiryWithConversation } from "./inquiryMutations";
import {
  cancelViewing,
  confirmViewing,
  createViewingRequest,
  declineViewing,
  deleteViewing,
  markViewingCompleted,
  acceptViewingReschedule,
} from "./viewingMutations";
import { VIEWING_STATUS } from "./crmConstants";

describe("viewingMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createViewingRequest uses inquiry RPC when flags enabled", async () => {
    createInquiryWithConversation.mockResolvedValue({
      data: { id: "inq-1", conversationId: "conv-1", viewingId: "view-1" },
      error: null,
    });

    const client = { rpc: jest.fn(), from: jest.fn() };

    const result = await createViewingRequest(client, {
      listingId: 12,
      agentUserId: "agent-1",
      requestedDate: "2026-07-01",
      requestedTime: "10:00",
      requesterEmail: "buyer@test.com",
    });

    expect(result.error).toBeNull();
    expect(result.data.id).toBe("view-1");
    expect(createInquiryWithConversation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        inquiryType: "schedule_viewing",
        requestedDate: "2026-07-01",
        requestedTime: "10:00",
      })
    );
    expect(enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  test("confirmViewing emits public viewing_scheduled event", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "view-1",
          listing_id: 5,
          conversation_id: "conv-1",
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
      if (table === "conversations") {
        return {
          update: jest
            .fn()
            .mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }),
        };
      }
      return { update };
    });
    const client = { from };

    const { error } = await confirmViewing(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });

    expect(error).toBeNull();
    expect(emitListingEventAfterMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: LISTING_EVENT_TYPES.VIEWING_SCHEDULED,
        visibility: "public",
      })
    );
  });

  test("declineViewing sets declined status", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "view-1", listing_id: 2, requester_id: "buyer-1" },
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
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED }),
      expect.any(Object)
    );
  });

  test("markViewingCompleted updates status", async () => {
    const chain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "view-1", status: VIEWING_STATUS.COMPLETED }, error: null }),
    };
    const client = {
      from: jest.fn(() => ({ update: jest.fn().mockReturnValue(chain) })),
    };
    const { data, error } = await markViewingCompleted(client, {
      viewingId: "view-1",
      agentUserId: "agent-1",
    });
    expect(error).toBeNull();
    expect(data.status).toBe(VIEWING_STATUS.COMPLETED);
  });

  test("acceptViewingReschedule as buyer confirms and notifies agent", async () => {
    const current = {
      id: "view-1",
      listing_id: 5,
      conversation_id: "conv-1",
      requester_id: "buyer-1",
      agent_user_id: "agent-1",
      proposed_date: "2026-07-10",
      proposed_time: "14:00:00",
      proposed_by: "agent",
    };
    const confirmed = {
      ...current,
      requested_date: "2026-07-10",
      requested_time: "14:00:00",
      proposed_date: null,
      proposed_time: null,
      proposed_by: null,
      status: VIEWING_STATUS.CONFIRMED,
    };

    const fetchChain = {
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: current, error: null }),
    };
    const updateChain = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: confirmed, error: null }),
    };
    const from = jest.fn((table) => {
      if (table === "viewing_requests") {
        return {
          select: jest.fn().mockReturnValue(fetchChain),
          update: jest.fn().mockReturnValue(updateChain),
        };
      }
      if (table === "conversations") {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });
    const client = { from };

    const { data, error } = await acceptViewingReschedule(client, {
      viewingId: "view-1",
      actorUserId: "buyer-1",
      asAgent: false,
    });

    expect(error).toBeNull();
    expect(data.status).toBe(VIEWING_STATUS.CONFIRMED);
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
        recipientId: "agent-1",
        payload: expect.objectContaining({
          recipient_role: "user",
          recipient_side: "owner",
        }),
      }),
      expect.any(Object)
    );
  });

  test("createViewingRequest inserts viewing_requests when RPC unavailable", async () => {
    jest.resetModules();
    jest.doMock("../featureFlags", () => ({
      BL_ENABLE_CONVERSATIONS: false,
      BL_ENABLE_VIEWING_PERSIST: false,
      BL_ENABLE_NOTIFICATIONS: false,
    }));
    jest.doMock("../notifications/notificationEvents", () => ({
      enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "q1" }),
      triggerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
      NOTIFICATION_EVENT_TYPES: {
        VIEWING_REQUESTED: "viewing_requested",
      },
    }));
    const { createViewingRequest: createDirect } = await import("./viewingMutations");

    const single = jest.fn().mockResolvedValue({ data: { id: "v1" }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const client = { from: jest.fn().mockReturnValue({ insert }) };

    const { data } = await createDirect(client, {
      listingId: 3,
      agentUserId: "agent-1",
      requestedDate: "2026-07-02",
      requestedTime: "14:00",
    });

    expect(data.id).toBe("v1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: VIEWING_STATUS.PENDING,
        requested_date: "2026-07-02",
      })
    );
  });

  test("deleteViewing as buyer only sets requester_deleted_at for requester", async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "v1" }, error: null }),
      }),
    });
    const client = { from: jest.fn(() => ({ update })) };

    await deleteViewing(client, {
      viewingId: "v1",
      userId: "buyer-1",
      asAgent: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ requester_deleted_at: expect.any(String) })
    );
    const chain = update.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("id", "v1");
    expect(chain.eq.mock.results[0].value.eq).toHaveBeenCalledWith("requester_id", "buyer-1");
  });

  test("deleteViewing as agent only sets agent_deleted_at for listing contact", async () => {
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
    const chain = update.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("id", "v1");
    expect(chain.eq.mock.results[0].value.eq).toHaveBeenCalledWith("agent_user_id", "agent-1");
  });
});
