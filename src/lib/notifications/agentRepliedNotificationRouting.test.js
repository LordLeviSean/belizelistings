import { resolveAgentRepliedNotificationHref } from "./agentRepliedNotificationRouting";

describe("resolveAgentRepliedNotificationHref", () => {
  test("routes buyer to user inbox conversation", () => {
    expect(
      resolveAgentRepliedNotificationHref({
        recipientRole: "user",
        payload: { conversation_id: "conv-123" },
      })
    ).toBe("/dashboard/user?tab=inbox&conversation=conv-123");
  });

  test("matches push destination resolver used by new_inquiry pattern", () => {
    const input = {
      recipientRole: "user",
      payload: {
        conversation_id: "conv-456",
        recipient_role: "user",
        recipient_side: "buyer",
      },
    };
    expect(resolveAgentRepliedNotificationHref(input)).toBe(
      "/dashboard/user?tab=inbox&conversation=conv-456"
    );
  });
});
