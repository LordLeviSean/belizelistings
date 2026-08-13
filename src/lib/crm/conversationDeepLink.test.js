/** @jest-environment node */

import {
  conversationIdsMatch,
  conversationListIncludesId,
  isDeepLinkConversationPending,
  mergeConversationIntoList,
  normalizeConversationId,
} from "./conversationDeepLink";

describe("conversationDeepLink", () => {
  test("conversationIdsMatch coerces string and numeric ids", () => {
    expect(conversationIdsMatch("abc", "abc")).toBe(true);
    expect(conversationIdsMatch(42, "42")).toBe(true);
    expect(conversationIdsMatch("a", "b")).toBe(false);
  });

  test("mergeConversationIntoList upserts by id", () => {
    const list = [{ id: "c1", last_message_body: "old" }];
    const merged = mergeConversationIntoList(list, { id: "c1", last_message_body: "new" });
    expect(merged).toHaveLength(1);
    expect(merged[0].last_message_body).toBe("new");
  });

  test("isDeepLinkConversationPending is false once resolved in list", () => {
    expect(
      isDeepLinkConversationPending({
        initialConversationId: "c1",
        conversations: [{ id: "c1" }],
        resolveState: "resolved",
      })
    ).toBe(false);
  });

  test("isDeepLinkConversationPending stays true while loading", () => {
    expect(
      isDeepLinkConversationPending({
        initialConversationId: "c1",
        conversations: [],
        resolveState: "loading",
      })
    ).toBe(true);
  });

  test("isDeepLinkConversationPending ends at missing state", () => {
    expect(
      isDeepLinkConversationPending({
        initialConversationId: "c1",
        conversations: [],
        resolveState: "missing",
      })
    ).toBe(false);
  });

  test("isDeepLinkConversationPending ends at error state", () => {
    expect(
      isDeepLinkConversationPending({
        initialConversationId: "c1",
        conversations: [],
        resolveState: "error",
      })
    ).toBe(false);
  });

  test("conversationListIncludesId uses normalized comparison", () => {
    expect(conversationListIncludesId([{ id: "conv-9" }], "conv-9")).toBe(true);
    expect(normalizeConversationId("  x  ")).toBe("x");
  });
});
