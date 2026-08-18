/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNotificationPresentation } from "./notificationCopyRegistry";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { buildBuyerRepliedDedupeKey } from "./crmNotificationHelpers";
import { performBuyerReply } from "../crm/conversationMutations";

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("./notificationEvents", () => ({
  enqueueNotificationEvent: jest.fn().mockResolvedValue({ ok: true, queueId: "q-inbox-1" }),
  NOTIFICATION_EVENT_TYPES: {
    NEW_INQUIRY: "new_inquiry",
    BUYER_REPLIED: "buyer_replied",
    AGENT_REPLIED: "agent_replied",
    ADMIN_REPLIED: "admin_replied",
  },
}));

import { enqueueNotificationEvent } from "./notificationEvents";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260818120000_reused_conversation_buyer_replied.sql"
);

describe("Pass 7 reused-conversation event identity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("SQL migration enqueues buyer_replied with message-level dedupe on reuse", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toContain("'buyer_replied'");
    expect(sql).toContain(
      "'dedupe_key', 'buyer_replied:' || v_message_id::text || ':' || p_agent_user_id::text"
    );
    expect(sql).not.toContain("'buyer_message:'");
    expect(sql).toMatch(/IF v_conversation_id IS NOT NULL THEN[\s\S]*'buyer_replied'/);
    expect(sql).toContain("'reused_conversation', false");
    expect(sql).toMatch(/INSERT INTO public\.notification_queue[\s\S]*'new_inquiry'/);
  });

  test("message-level dedupe keys are distinct per message for same recipient", () => {
    const recipient = "agent-1";
    const keyA = buildBuyerRepliedDedupeKey("msg-a", recipient);
    const keyB = buildBuyerRepliedDedupeKey("msg-b", recipient);
    const keyC = buildBuyerRepliedDedupeKey("msg-c", recipient);

    expect(keyA).toBe("buyer_replied:msg-a:agent-1");
    expect(keyB).toBe("buyer_replied:msg-b:agent-1");
    expect(keyC).toBe("buyer_replied:msg-c:agent-1");
    expect(new Set([keyA, keyB, keyC]).size).toBe(3);
  });

  test("retry/idempotency collapses to one logical key per message", () => {
    const key = buildBuyerRepliedDedupeKey("msg-a", "agent-1");
    expect(buildBuyerRepliedDedupeKey("msg-a", "agent-1")).toBe(key);
  });

  test("new conversation copy differs from buyer reply copy", () => {
    const newInquiry = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, {
      conversation_id: "conv-1",
      message_id: "msg-1",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      recipient_role: "agent",
    });
    const buyerReplied = buildNotificationPresentation(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, {
      conversation_id: "conv-1",
      message_id: "msg-2",
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      recipient_role: "agent",
    });

    expect(newInquiry.title).toBe("New property inquiry");
    expect(buyerReplied.title).toBe("Buyer replied");
    expect(newInquiry.body).not.toBe(buyerReplied.body);
    expect(newInquiry.href).toBe(buyerReplied.href);
    expect(newInquiry.href).toBe("/dashboard/agent?tab=inbox&conversation=conv-1");
  });

  test("inbox buyer reply enqueues buyer_replied to agent recipient only", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "msg-inbox-2" }, error: null }),
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

    await performBuyerReply(client, {
      conversationId: "conv-1",
      buyerUserId: "buyer-1",
      body: "Second message from inbox",
      listingId: 42,
      senderName: "Alexis Marie",
    });

    expect(enqueueNotificationEvent).toHaveBeenCalledTimes(1);
    expect(enqueueNotificationEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "buyer_replied",
        recipientId: "agent-1",
        payload: expect.objectContaining({
          dedupe_key: "buyer_replied:msg-inbox-2:agent-1",
          conversation_id: "conv-1",
        }),
      }),
      expect.objectContaining({ deliver: false })
    );
    expect(enqueueNotificationEvent.mock.calls[0][1].recipientId).not.toBe("buyer-1");
  });

  test("listing inquiry reuse contract uses same dedupe scheme as inbox path", () => {
    const messageId = "msg-listing-followup";
    const agentId = "agent-1";
    const sqlDedupe = `buyer_replied:${messageId}:${agentId}`;
    const jsDedupe = buildBuyerRepliedDedupeKey(messageId, agentId);

    expect(sqlDedupe).toBe(jsDedupe);
  });
});
