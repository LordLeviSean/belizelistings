/** @jest-environment node */

import {
  resolveAgentViewingDeepLink,
  resolveParticipantViewingDeepLink,
} from "./viewingParticipantDeepLink";

function createClient({ viewingRow = null, listingRow = null, viewingError = null } = {}) {
  const viewingQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: viewingRow, error: viewingError }),
  };

  const listingQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: listingRow, error: null }),
  };

  return {
    from: jest.fn((table) => {
      if (table === "viewing_requests") return viewingQuery;
      if (table === "listings") return listingQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("resolveParticipantViewingDeepLink", () => {
  test("agent path fetches declined viewing outside list window", async () => {
    const client = createClient({
      viewingRow: { id: "v-decline", status: "declined", listing_id: 2 },
    });

    const result = await resolveAgentViewingDeepLink(client, "agent-1", "v-decline", [], {});

    expect(result.resolved).toBe(true);
    expect(result.viewings[0].status).toBe("declined");
    const viewingQuery = client.from.mock.results[0].value;
    expect(viewingQuery.eq).toHaveBeenCalledWith("agent_user_id", "agent-1");
  });

  test("buyer and agent share participant resolver", async () => {
    const client = createClient({
      viewingRow: { id: 108, status: "confirmed", listing_id: null },
    });

    await resolveParticipantViewingDeepLink(client, "buyer-1", 108, [], {}, { asAgent: false });

    const viewingQuery = client.from.mock.results[0].value;
    expect(viewingQuery.eq).toHaveBeenCalledWith("requester_id", "buyer-1");
    expect(viewingQuery.eq).toHaveBeenCalledWith("id", "108");
  });

  test("returns missing when maybeSingle succeeds with no row", async () => {
    const result = await resolveParticipantViewingDeepLink(
      createClient({ viewingRow: null }),
      "buyer-1",
      "missing-viewing",
      [],
      {},
      { asAgent: false }
    );

    expect(result.outcome).toBe("missing");
    expect(result.fetched).toBe(true);
  });

  test("returns error when Supabase query fails", async () => {
    const result = await resolveParticipantViewingDeepLink(
      createClient({ viewingError: { message: "network failure" } }),
      "buyer-1",
      "view-1",
      [],
      {},
      { asAgent: false }
    );

    expect(result.outcome).toBe("error");
    expect(result.error?.message).toBe("network failure");
  });
});
