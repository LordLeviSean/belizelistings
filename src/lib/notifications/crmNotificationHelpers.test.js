/** @jest-environment node */

import {
  buildAgentRepliedDedupeKey,
  buildInboxMessagePayload,
} from "./crmNotificationHelpers";

describe("crmNotificationHelpers agent_replied dedupe", () => {
  test("buildAgentRepliedDedupeKey scopes to message and recipient", () => {
    expect(buildAgentRepliedDedupeKey("msg-1", "buyer-1")).toBe("agent_replied:msg-1:buyer-1");
    expect(buildAgentRepliedDedupeKey(null, "buyer-1")).toBeNull();
  });

  test("buildInboxMessagePayload uses message-recipient dedupe for agent replies", () => {
    const payload = buildInboxMessagePayload({
      conversationId: "conv-1",
      messageId: "msg-9",
      recipientUserId: "buyer-1",
      recipientSide: "buyer",
      dedupePrefix: "agent_replied",
    });

    expect(payload.dedupe_key).toBe("agent_replied:msg-9:buyer-1");
  });

  test("distinct replies in one conversation produce distinct dedupe keys", () => {
    const first = buildInboxMessagePayload({
      conversationId: "conv-1",
      messageId: "msg-a",
      recipientUserId: "buyer-1",
      recipientSide: "buyer",
      dedupePrefix: "agent_replied",
    });
    const second = buildInboxMessagePayload({
      conversationId: "conv-1",
      messageId: "msg-b",
      recipientUserId: "buyer-1",
      recipientSide: "buyer",
      dedupePrefix: "agent_replied",
    });

    expect(first.dedupe_key).not.toBe(second.dedupe_key);
  });
});
