/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../notifications/notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "q1" }),
  NOTIFICATION_EVENT_TYPES: {
    NEW_INQUIRY: "new_inquiry",
    BUYER_REPLIED: "buyer_replied",
    AGENT_REPLIED: "agent_replied",
    ADMIN_REPLIED: "admin_replied",
  },
}));

jest.mock("../notifications/triggerServerNotificationDelivery", () => ({
  triggerServerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

import {
  conversationPreviewText,
  deleteConversationForAgent,
  deleteConversationForBuyer,
  isAgentConversationUnread,
  isBuyerConversationUnread,
  performAgentReply,
  sendAgentReply,
  sendBuyerReply,
} from "./conversationMutations";
import { enqueueNotificationEvent } from "../notifications/notificationEvents";
import { triggerServerNotificationDelivery } from "../notifications/triggerServerNotificationDelivery";
import { CRM_PIPELINE_STAGE, INQUIRY_STATUS } from "./crmConstants";

describe("conversationMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("conversationPreviewText prefers last_message_body", () => {
    expect(
      conversationPreviewText({
        last_message_body: "Latest note",
        listing_inquiries: { message: "Original inquiry" },
      })
    ).toBe("Latest note");
  });

  test("isAgentConversationUnread respects inquiry read_at", () => {
    expect(
      isAgentConversationUnread({
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.NEW, read_at: null },
      })
    ).toBe(true);
    expect(
      isAgentConversationUnread({
        pipeline_stage: CRM_PIPELINE_STAGE.NEW_INQUIRY,
        listing_inquiries: { status: INQUIRY_STATUS.OPENED, read_at: "2026-01-01" },
      })
    ).toBe(false);
  });

  test("isBuyerConversationUnread uses buyer_unread flag", () => {
    expect(isBuyerConversationUnread({ buyer_unread: true })).toBe(true);
    expect(isBuyerConversationUnread({ buyer_unread: false })).toBe(false);
  });

  test("sendBuyerReply notifies agent with buyer_replied and triggers delivery", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null }),
      }),
    });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { agent_id: "agent-1", listing_id: 42, inquiry_id: "inq-1" },
    });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnThis() });
    const client = {
      from: jest.fn((table) => {
        if (table === "messages") return { insert };
        if (table === "profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent", username: "agent_user" } }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: update }),
            }),
          };
        }
        return {};
      }),
    };

    const result = await sendBuyerReply(client, {
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
      body: "Follow up question",
      listingId: 42,
    });

    expect(result.error).toBeNull();
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "buyer_replied",
        recipientId: "agent-1",
        payload: expect.objectContaining({
          dedupe_key: "buyer_replied:msg-1:agent-1",
        }),
      }),
      expect.any(Object)
    );
    expect(triggerServerNotificationDelivery).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ queueId: "q1" })
    );
  });

  test("sendAgentReply notifies buyer with message-scoped dedupe", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-2" }, error: null }),
      }),
    });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { inquiry_id: "inq-1", buyer_id: "buyer-1", listing_id: 42 },
    });
    const client = {
      from: jest.fn((table) => {
        if (table === "messages") return { insert };
        if (table === "profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent", username: "agent_user" } }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ maybeSingle }),
            }),
          };
        }
        if (table === "listing_inquiries") {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({}),
            }),
          };
        }
        return {};
      }),
    };

    await sendAgentReply(client, {
      conversationId: "conv-1",
      agentUserId: "agent-1",
      body: "Thanks for reaching out",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "agent_replied",
        recipientId: "buyer-1",
        payload: expect.objectContaining({
          dedupe_key: "agent_replied:msg-2:buyer-1",
          message_id: "msg-2",
        }),
      }),
      expect.any(Object)
    );
    expect(triggerServerNotificationDelivery).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ queueId: "q1" })
    );
  });

  test("performAgentReply enqueues once per reply without self-delivery trigger", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-3" }, error: null }),
      }),
    });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { inquiry_id: "inq-1", buyer_id: "buyer-1", listing_id: 42 },
    });
    const client = {
      from: jest.fn((table) => {
        if (table === "messages") return { insert };
        if (table === "profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent", username: "agent_user" } }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ maybeSingle }),
            }),
          };
        }
        if (table === "listing_inquiries") {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({}),
            }),
          };
        }
        return {};
      }),
    };

    const result = await performAgentReply(client, {
      conversationId: "conv-1",
      agentUserId: "agent-1",
      body: "One reply only",
    });

    expect(result.queueId).toBe("q1");
    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(1);
    expect(triggerServerNotificationDelivery).not.toHaveBeenCalled();
  });

  test("deleteConversationForBuyer only updates buyer participant column", async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
    });
    const client = {
      from: jest.fn(() => ({ update })),
    };

    await deleteConversationForBuyer(client, {
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ buyer_deleted_at: expect.any(String) })
    );
    const secondEq = update.mock.results[0].value.eq;
    expect(secondEq).toHaveBeenCalledWith("id", "conv-1");
    expect(secondEq.mock.results[0].value.eq).toHaveBeenCalledWith("buyer_id", "buyer-1");
  });

  test("deleteConversationForAgent binds delete to agent participant column", async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
    });
    const client = {
      from: jest.fn(() => ({ update })),
    };

    await deleteConversationForAgent(client, {
      conversationId: "conv-1",
      agentUserId: "agent-1",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ agent_deleted_at: expect.any(String) })
    );
    const chain = update.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("id", "conv-1");
    expect(chain.eq.mock.results[0].value.eq).toHaveBeenCalledWith("agent_id", "agent-1");
  });
});
