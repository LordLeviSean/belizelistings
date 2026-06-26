/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("./inquiryMutations", () => ({
  createInquiryWithConversation: jest.fn(),
}));

import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import { createInquiryWithConversation } from "./inquiryMutations";
import { confirmViewing, createViewingRequest } from "./viewingMutations";
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

    const client = { rpc: jest.fn() };
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
      if (table === "conversations") return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }) };
      if (table === "notification_queue") return { insert: jest.fn().mockResolvedValue({ error: null }) };
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

  test("createViewingRequest inserts viewing_requests when RPC unavailable", async () => {
    jest.resetModules();
    jest.doMock("../featureFlags", () => ({
      BL_ENABLE_CONVERSATIONS: false,
      BL_ENABLE_VIEWING_PERSIST: false,
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
});
