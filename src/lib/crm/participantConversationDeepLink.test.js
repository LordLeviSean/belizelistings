/** @jest-environment node */

import { resolveParticipantConversationDeepLink } from "./participantConversationDeepLink";

function createClient({ conversationRow = null, listingRow = null, conversationError = null } = {}) {
  const conversationQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: conversationRow, error: conversationError }),
  };

  const listingQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: listingRow, error: null }),
  };

  return {
    from: jest.fn((table) => {
      if (table === "conversations") return conversationQuery;
      if (table === "listings") return listingQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("resolveParticipantConversationDeepLink", () => {
  test("reuses list data when conversation already loaded", async () => {
    const existing = [{ id: "conv-1", listing_id: 5 }];
    const result = await resolveParticipantConversationDeepLink(
      createClient(),
      "buyer-1",
      "conv-1",
      existing,
      {},
      { role: "buyer" }
    );

    expect(result.resolved).toBe(true);
    expect(result.fetched).toBe(false);
    expect(result.conversations).toBe(existing);
  });

  test("fetches buyer conversation by id when absent from list", async () => {
    const client = createClient({
      conversationRow: { id: "conv-deep", listing_id: 9, buyer_id: "buyer-1" },
      listingRow: { id: 9, title: "Lagoon Villa" },
    });

    const result = await resolveParticipantConversationDeepLink(
      client,
      "buyer-1",
      "conv-deep",
      [],
      {},
      { role: "buyer" }
    );

    expect(result.resolved).toBe(true);
    expect(result.fetched).toBe(true);
    expect(result.conversations[0].id).toBe("conv-deep");
    expect(result.listingsById[9].title).toBe("Lagoon Villa");
  });

  test("fetches agent conversation by id for owner/agent participant", async () => {
    const client = createClient({
      conversationRow: { id: "conv-agent", listing_id: 3, agent_id: "agent-1" },
    });

    const result = await resolveParticipantConversationDeepLink(
      client,
      "agent-1",
      "conv-agent",
      [],
      {},
      { role: "agent" }
    );

    expect(result.resolved).toBe(true);
    const conversationQuery = client.from.mock.results[0].value;
    expect(conversationQuery.eq).toHaveBeenCalledWith("agent_id", "agent-1");
  });

  test("returns missing when authorized conversation cannot be fetched", async () => {
    const result = await resolveParticipantConversationDeepLink(
      createClient({ conversationRow: null }),
      "buyer-1",
      "missing-conv",
      [],
      {},
      { role: "buyer" }
    );

    expect(result.outcome).toBe("missing");
    expect(result.resolved).toBe(false);
    expect(result.fetched).toBe(true);
  });

  test("returns error when Supabase query fails", async () => {
    const result = await resolveParticipantConversationDeepLink(
      createClient({ conversationError: { message: "network failure" } }),
      "buyer-1",
      "conv-1",
      [],
      {},
      { role: "buyer" }
    );

    expect(result.outcome).toBe("error");
    expect(result.resolved).toBe(false);
    expect(result.fetched).toBe(true);
    expect(result.error?.message).toBe("network failure");
  });
});
