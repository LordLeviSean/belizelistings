import {
  AGENT_REPLIED_PUSH_BODY,
  AGENT_REPLIED_PUSH_TITLE,
  buildAgentRepliedPushPayload,
} from "./buildAgentRepliedPushPayload";

describe("buildAgentRepliedPushPayload", () => {
  test("builds privacy-safe agent_replied push payload", () => {
    const built = buildAgentRepliedPushPayload({
      notificationId: "notif-reply-1",
      dedupeKey: "agent_replied:conv-1:msg-1",
      href: "/dashboard/user?tab=inbox&conversation=conv-1",
    });

    expect(built.ok).toBe(true);
    expect(built.payload).toEqual(
      expect.objectContaining({
        notificationId: "notif-reply-1",
        eventType: "agent_replied",
        title: AGENT_REPLIED_PUSH_TITLE,
        body: AGENT_REPLIED_PUSH_BODY,
        href: "/dashboard/user?tab=inbox&conversation=conv-1",
        tag: "agent_replied:conv-1:msg-1",
      })
    );
  });
});
