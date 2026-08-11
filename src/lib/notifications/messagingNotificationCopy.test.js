/** @jest-environment node */

import { buildNotificationPresentation } from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import {
  MESSAGE_SENDER_CONTEXT,
  buildMessagingInAppCopy,
  buildMessagingPushCopy,
  isSafePublicDisplayName,
  resolveReplySenderPresentation,
} from "./messagingNotificationCopy";
import { performAgentReply, sendBuyerReply } from "../crm/conversationMutations";

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("./notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "q-copy-1" }),
  NOTIFICATION_EVENT_TYPES: {
    NEW_INQUIRY: "new_inquiry",
    BUYER_REPLIED: "buyer_replied",
    AGENT_REPLIED: "agent_replied",
    ADMIN_REPLIED: "admin_replied",
  },
}));

jest.mock("./triggerServerNotificationDelivery", () => ({
  triggerServerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

import { enqueueNotificationEvent } from "./notificationEvents";
import { triggerServerNotificationDelivery } from "./triggerServerNotificationDelivery";

describe("messagingNotificationCopy", () => {
  test("new inquiry push copy uses buyer-interest language", () => {
    expect(buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {})).toEqual({
      title: "New property inquiry",
      body: "A buyer is interested in one of your listings.",
    });
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, { sender_name: "Alexis Marie" })
    ).toEqual({
      title: "New property inquiry",
      body: "Alexis Marie is interested in one of your listings.",
    });
  });

  test("buyer reply push copy is distinct from new inquiry", () => {
    expect(buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, {})).toEqual({
      title: "Buyer replied",
      body: "You received a new message about your listing.",
    });
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, { sender_name: "Alexis Marie" })
    ).toEqual({
      title: "Buyer replied",
      body: "Alexis Marie replied about your listing.",
    });
  });

  test("agent reply push copy personalizes agent senders", () => {
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
        sender_role: MESSAGE_SENDER_CONTEXT.AGENT,
      })
    ).toEqual({
      title: "Agent replied",
      body: "You received a reply to your property inquiry.",
    });
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
        sender_role: MESSAGE_SENDER_CONTEXT.AGENT,
        sender_name: "Coastal Realty",
      })
    ).toEqual({
      title: "Agent replied",
      body: "Coastal Realty replied to your inquiry.",
    });
  });

  test("owner reply push copy avoids calling listing contact an agent", () => {
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
        sender_role: MESSAGE_SENDER_CONTEXT.OWNER,
        sender_name: "Jordan Owner",
      })
    ).toEqual({
      title: "Listing contact replied",
      body: "Jordan Owner replied to your inquiry.",
    });
  });

  test("admin reply push copy is clearly platform-authored", () => {
    expect(buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED, {})).toEqual({
      title: "BelizeListings replied",
      body: "An admin responded to your conversation.",
    });
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED, {
        sender_name: "BelizeListings Support",
      })
    ).toEqual({
      title: "BelizeListings replied",
      body: "BelizeListings Support replied to your conversation.",
    });
  });

  test("unsafe sender names are not exposed in push copy", () => {
    expect(isSafePublicDisplayName("buyer@example.com")).toBe(false);
    expect(
      buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
        sender_name: "buyer@example.com",
      }).body
    ).toBe("A buyer is interested in one of your listings.");
  });

  test("resolveReplySenderPresentation maps platform roles", () => {
    expect(resolveReplySenderPresentation({ role: "agent", username: "coastal_realty" })).toEqual({
      senderRole: MESSAGE_SENDER_CONTEXT.AGENT,
      senderName: "Coastal Realty",
    });
    expect(resolveReplySenderPresentation({ role: "user", username: "jordan_owner" })).toEqual({
      senderRole: MESSAGE_SENDER_CONTEXT.OWNER,
      senderName: "Jordan Owner",
    });
    expect(resolveReplySenderPresentation({ role: "admin", username: "bl_support" })).toEqual({
      senderRole: MESSAGE_SENDER_CONTEXT.ADMIN,
      senderName: "BL Support",
    });
  });
});

describe("CRM messaging notification wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildBuyerReplyClient() {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-followup" }, error: null }),
      }),
    });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { agent_id: "agent-1", listing_id: 42, inquiry_id: "inq-1", buyer_name: "Alexis Marie" },
    });
    const client = {
      from: jest.fn((table) => {
        if (table === "messages") return { insert };
        if (table === "conversations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }),
            }),
          };
        }
        return {};
      }),
    };
    return client;
  }

  test("initial buyer inquiry remains new_inquiry at presentation layer", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      conversation_id: "conv-initial",
      message_id: "msg-initial",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      recipient_role: "agent",
    });
    expect(pres.title).toBe("New property inquiry");
    expect(pres.body).toContain("Alexis Marie");
    expect(pres.body).toContain("Finca Solana");
    expect(pres.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-initial");
  });

  test("second buyer message in same conversation enqueues buyer_replied", async () => {
    const client = buildBuyerReplyClient();

    await sendBuyerReply(client, {
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
      body: "Follow up question",
      listingId: 42,
      senderName: "Alexis Marie",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "buyer_replied",
        recipientId: "agent-1",
        payload: expect.objectContaining({
          dedupe_key: "buyer_replied:msg-followup:agent-1",
          sender_name: "Alexis Marie",
        }),
      }),
      expect.any(Object)
    );
    expect(triggerServerNotificationDelivery).toHaveBeenCalledTimes(1);
  });

  test("buyer_replied in-app presentation routes to owner inbox conversation", () => {
    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, {
      conversation_id: "conv-followup",
      message_id: "msg-followup",
      recipient_user_id: "agent-1",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      recipient_role: "agent",
    });
    expect(pres.title).toBe("Buyer replied");
    expect(pres.body).toContain("Alexis Marie");
    expect(pres.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-followup");
    expect(buildMessagingInAppCopy(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, {
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
    }).body).toContain("Finca Solana");
  });

  test("agent reply enqueues agent_replied with sender role and name", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-agent" }, error: null }),
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
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { role: "agent", username: "coastal_realty" },
                }),
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

    await performAgentReply(client, {
      conversationId: "conv-1",
      agentUserId: "agent-1",
      body: "Happy to help",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "agent_replied",
        recipientId: "buyer-1",
        payload: expect.objectContaining({
          dedupe_key: "agent_replied:msg-agent:buyer-1",
          sender_role: "agent",
          sender_name: "Coastal Realty",
        }),
      }),
      expect.any(Object)
    );
  });

  test("owner reply keeps agent_replied event but uses owner sender role", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-owner" }, error: null }),
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
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { role: "user", username: "jordan_owner" },
                }),
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

    await performAgentReply(client, {
      conversationId: "conv-1",
      agentUserId: "owner-1",
      body: "Thanks for your interest",
    });

    const pres = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.AGENT_REPLIED, {
      conversation_id: "conv-1",
      message_id: "msg-owner",
      recipient_user_id: "buyer-1",
      sender_role: MESSAGE_SENDER_CONTEXT.OWNER,
      sender_name: "Jordan Owner",
      listing_title: "Finca Solana",
      recipient_role: "user",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        payload: expect.objectContaining({ sender_role: "owner" }),
      }),
      expect.any(Object)
    );
    expect(pres.title).toBe("Listing contact replied");
    expect(pres.href).toBe("/dashboard/user?tab=inbox&conversation=conv-1");
  });

  test("admin reply enqueues admin_replied for buyer recipient", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-admin" }, error: null }),
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
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { role: "admin", username: "bl_support" },
                }),
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

    await performAgentReply(client, {
      conversationId: "conv-1",
      agentUserId: "admin-1",
      body: "We are here to help",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "admin_replied",
        recipientId: "buyer-1",
        payload: expect.objectContaining({
          dedupe_key: "admin_replied:msg-admin:buyer-1",
          sender_role: "admin",
        }),
      }),
      expect.any(Object)
    );
  });
});
