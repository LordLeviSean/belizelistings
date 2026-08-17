/** @jest-environment node */

import {
  applyAgentConversationLoadResult,
  applyAgentViewingLoadResult,
  applyBuyerCrmLoadResult,
  applyConversationListWithDeepLink,
  applyOwnerInboxLoadResult,
  applyViewingListWithDeepLink,
  beginCrmRequest,
  invalidateCrmRequests,
  isStaleCrmRequest,
} from "./crmListLoaderUtils";

describe("crmListLoaderUtils", () => {
  test("beginCrmRequest increments generation and isStale detects superseded requests", () => {
    const generationRef = { current: 0 };
    const first = beginCrmRequest(generationRef);
    const second = beginCrmRequest(generationRef);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(isStaleCrmRequest(generationRef, first)).toBe(true);
    expect(isStaleCrmRequest(generationRef, second)).toBe(false);
  });

  test("invalidateCrmRequests ignores in-flight responses after unmount", () => {
    const generationRef = { current: 0 };
    const generation = beginCrmRequest(generationRef);
    invalidateCrmRequests(generationRef);
    expect(isStaleCrmRequest(generationRef, generation)).toBe(true);
  });

  test("buyer CRM race: B resolves before stale A and B remains authoritative", () => {
    const generationRef = { current: 0 };
    const generationA = beginCrmRequest(generationRef);
    const generationB = beginCrmRequest(generationRef);

    const appliedB = applyBuyerCrmLoadResult({
      generationRef,
      generation: generationB,
      result: {
        inquiries: [],
        conversations: [{ id: "conv-new", listing_id: 2 }],
        viewings: [{ id: "view-new", listing_id: 2 }],
        listingsById: { 2: { id: 2, title: "New listing" } },
        errors: {},
      },
      previous: { conversations: [], viewings: [], listingsById: {} },
    });

    const appliedA = applyBuyerCrmLoadResult({
      generationRef,
      generation: generationA,
      result: {
        inquiries: [],
        conversations: [{ id: "conv-old", listing_id: 1 }],
        viewings: [{ id: "view-old", listing_id: 1 }],
        listingsById: { 1: { id: 1, title: "Old listing" } },
        errors: {},
      },
      previous: { conversations: [], viewings: [], listingsById: {} },
    });

    expect(appliedB?.conversations[0].id).toBe("conv-new");
    expect(appliedA).toBeNull();
  });

  test("agent conversation race keeps newest response", () => {
    const generationRef = { current: 0 };
    const generationA = beginCrmRequest(generationRef);
    const generationB = beginCrmRequest(generationRef);

    const appliedB = applyAgentConversationLoadResult({
      generationRef,
      generation: generationB,
      incoming: [{ id: "conv-b" }],
      previous: [],
      error: null,
    });
    const appliedA = applyAgentConversationLoadResult({
      generationRef,
      generation: generationA,
      incoming: [{ id: "conv-a" }],
      previous: [],
      error: null,
    });

    expect(appliedB?.conversations[0].id).toBe("conv-b");
    expect(appliedA).toBeNull();
  });

  test("agent viewing race keeps newest response", () => {
    const generationRef = { current: 0 };
    const generationA = beginCrmRequest(generationRef);
    const generationB = beginCrmRequest(generationRef);

    const appliedB = applyAgentViewingLoadResult({
      generationRef,
      generation: generationB,
      incoming: [{ id: "view-b" }],
      previous: [],
      error: null,
    });
    const appliedA = applyAgentViewingLoadResult({
      generationRef,
      generation: generationA,
      incoming: [{ id: "view-a" }],
      previous: [],
      error: null,
    });

    expect(appliedB?.viewings[0].id).toBe("view-b");
    expect(appliedA).toBeNull();
  });

  test("partial fetch error preserves only failed resource data", () => {
    const generationRef = { current: 0 };
    const generation = beginCrmRequest(generationRef);

    const applied = applyBuyerCrmLoadResult({
      generationRef,
      generation,
      result: {
        conversations: [],
        viewings: [{ id: "view-new", listing_id: 2 }],
        inquiries: [],
        listingsById: { 2: { id: 2, title: "Fresh viewing" } },
        errors: { conversations: { message: "network down" } },
      },
      previous: {
        conversations: [{ id: "conv-keep", listing_id: 1 }],
        viewings: [{ id: "view-old", listing_id: 1 }],
        listingsById: { 1: { id: 1, title: "Keep me" } },
      },
    });

    expect(applied?.conversations).toEqual([{ id: "conv-keep", listing_id: 1 }]);
    expect(applied?.viewings).toEqual([{ id: "view-new", listing_id: 2 }]);
  });

  test("successful zero rows is empty, not error", () => {
    const generationRef = { current: 0 };
    const generation = beginCrmRequest(generationRef);

    const applied = applyBuyerCrmLoadResult({
      generationRef,
      generation,
      result: {
        conversations: [],
        viewings: [],
        inquiries: [],
        listingsById: {},
        errors: {},
      },
      previous: { conversations: [], viewings: [], listingsById: {} },
    });

    expect(applied?.conversationError).toBeNull();
    expect(applied?.viewingError).toBeNull();
    expect(applied?.conversations).toEqual([]);
  });

  test("generic list refresh preserves deep-linked conversation target", () => {
    const merged = applyConversationListWithDeepLink({
      incoming: [{ id: "conv-other" }],
      previous: [{ id: "conv-target", listing_id: 9 }],
      deepLinkId: "conv-target",
    });

    expect(merged.some((row) => row.id === "conv-target")).toBe(true);
    expect(merged.some((row) => row.id === "conv-other")).toBe(true);
  });

  test("generic list refresh preserves deep-linked viewing target", () => {
    const merged = applyViewingListWithDeepLink({
      incoming: [{ id: "view-other" }],
      previous: [{ id: "view-target", listing_id: 9 }],
      deepLinkId: "view-target",
    });

    expect(merged.some((row) => row.id === "view-target")).toBe(true);
    expect(merged.some((row) => row.id === "view-other")).toBe(true);
  });

  test("Pass 2 interaction: stale generic list without target keeps resolved entity", () => {
    const generationRef = { current: 0 };
    const generation = beginCrmRequest(generationRef);

    const applied = applyBuyerCrmLoadResult({
      generationRef,
      generation,
      result: {
        conversations: [{ id: "conv-other" }],
        viewings: [],
        inquiries: [],
        listingsById: {},
        errors: {},
      },
      previous: {
        conversations: [{ id: "conv-target", listing_id: 42 }],
        viewings: [],
        listingsById: { 42: { id: 42, title: "Deep link listing" } },
      },
      deepLinkConversationId: "conv-target",
    });

    expect(applied?.conversations.some((row) => row.id === "conv-target")).toBe(true);
  });

  test("owner inbox load keeps deep-linked conversation when generic list omits it", () => {
    const generationRef = { current: 0 };
    const generation = beginCrmRequest(generationRef);

    const applied = applyOwnerInboxLoadResult({
      generationRef,
      generation,
      result: {
        conversations: [{ id: "conv-other" }],
        viewings: [],
        listingsById: {},
        errors: {},
      },
      previous: {
        conversations: [{ id: "conv-owner-target", listing_id: 5 }],
        viewings: [],
        listingsById: { 5: { id: 5, title: "Owner listing" } },
      },
      deepLinkConversationId: "conv-owner-target",
    });

    expect(applied?.conversations.some((row) => row.id === "conv-owner-target")).toBe(true);
  });

  test("repeated refresh cannot apply stale overwrite after newer refresh", () => {
    const generationRef = { current: 0 };
    const first = beginCrmRequest(generationRef);
    const second = beginCrmRequest(generationRef);
    const third = beginCrmRequest(generationRef);

    applyAgentConversationLoadResult({
      generationRef,
      generation: second,
      incoming: [{ id: "conv-middle" }],
      previous: [],
      error: null,
    });

    const staleFirst = applyAgentConversationLoadResult({
      generationRef,
      generation: first,
      incoming: [{ id: "conv-first" }],
      previous: [{ id: "conv-middle" }],
      error: null,
    });

    const latest = applyAgentConversationLoadResult({
      generationRef,
      generation: third,
      incoming: [{ id: "conv-latest" }],
      previous: [{ id: "conv-middle" }],
      error: null,
    });

    expect(staleFirst).toBeNull();
    expect(latest?.conversations[0].id).toBe("conv-latest");
  });
});
