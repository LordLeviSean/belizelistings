/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_VIEWING_PERSIST: true,
  BL_ENABLE_TURNSTILE: false,
  BL_ENABLE_NOTIFICATIONS: false,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

import { emitListingEventAfterMutation } from "../listingEvents/writeListingEvent";
import { LISTING_EVENT_TYPES } from "../listingEvents/listingEventTypes";
import {
  createInquiryWithConversation,
  submitListingInquiry,
} from "./inquiryMutations";
import { INQUIRY_TYPE } from "./crmConstants";

describe("inquiryMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createInquiryWithConversation calls RPC and emits internal event", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: {
          inquiry_id: "inq-1",
          conversation_id: "conv-1",
          message_id: "msg-1",
        },
        error: null,
      }),
    };

    const result = await createInquiryWithConversation(client, {
      listingId: "42",
      agentUserId: "agent-1",
      senderEmail: "buyer@test.com",
      message: "Interested in this property.",
      inquiryType: INQUIRY_TYPE.GENERAL,
    });

    expect(result.error).toBeNull();
    expect(result.data.id).toBe("inq-1");
    expect(result.data.conversationId).toBe("conv-1");
    expect(client.rpc).toHaveBeenCalledWith(
      "create_inquiry_with_conversation",
      expect.objectContaining({
        p_listing_id: 42,
        p_agent_user_id: "agent-1",
        p_inquiry_type: "general",
      })
    );
    expect(emitListingEventAfterMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: LISTING_EVENT_TYPES.CONVERSATION_CREATED,
        visibility: "internal",
      })
    );
  });

  test("submitListingInquiry falls back to legacy insert when RPC unavailable", async () => {
    jest.resetModules();
    jest.doMock("../featureFlags", () => ({ BL_ENABLE_CONVERSATIONS: false }));
    const { submitListingInquiry: submitLegacy } = await import("./inquiryMutations");

    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "legacy-1" }, error: null }),
      }),
    });
    const client = { from: jest.fn().mockReturnValue({ insert }) };

    const { data, error } = await submitLegacy(client, {
      listingId: 7,
      agentUserId: "agent-1",
      body: "Hello there agent!",
      channel: "contact",
    });

    expect(error).toBeNull();
    expect(data.id).toBe("legacy-1");
    expect(client.from).toHaveBeenCalledWith("listing_inquiries");
  });

  test("submitListingInquiry prefers RPC when conversations flag enabled", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: { inquiry_id: "inq-2", conversation_id: "conv-2" },
        error: null,
      }),
    };

    const { data, error } = await submitListingInquiry(client, {
      listingId: "99",
      agentUserId: "agent-1",
      body: "Schedule a tour please.",
      channel: "contact",
    });

    expect(error).toBeNull();
    expect(data.id).toBe("inq-2");
    expect(client.rpc).toHaveBeenCalled();
  });
});
