/** @jest-environment node */

import { resolveBuyerViewingDeepLink } from "./buyerViewingDeepLink";

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

describe("resolveBuyerViewingDeepLink", () => {
  test("reuses list data when target viewing is already loaded", async () => {
    const existing = [{ id: "view-confirmed-1", status: "confirmed", listing_id: 42 }];
    const result = await resolveBuyerViewingDeepLink(
      createClient(),
      "buyer-1",
      "view-confirmed-1",
      existing,
      {}
    );

    expect(result.resolved).toBe(true);
    expect(result.fetched).toBe(false);
    expect(result.viewings).toBe(existing);
  });

  test("fetches declined viewing by id when absent from list", async () => {
    const client = createClient({
      viewingRow: {
        id: "view-declined-1",
        status: "declined",
        listing_id: 7,
      },
      listingRow: { id: 7, title: "Coastal Lot" },
    });

    const result = await resolveBuyerViewingDeepLink(client, "buyer-1", "view-declined-1", [], {});

    expect(result.resolved).toBe(true);
    expect(result.fetched).toBe(true);
    expect(result.viewings).toEqual([
      expect.objectContaining({ id: "view-declined-1", status: "declined" }),
    ]);
    expect(result.listingsById[7]).toEqual(expect.objectContaining({ title: "Coastal Lot" }));
  });

  test("normalizes numeric viewing ids for direct fetch", async () => {
    const client = createClient({
      viewingRow: { id: 108, status: "confirmed", listing_id: null },
    });

    await resolveBuyerViewingDeepLink(client, "buyer-1", 108, [], {});

    const viewingQuery = client.from.mock.results[0].value;
    expect(viewingQuery.eq).toHaveBeenCalledWith("id", "108");
  });

  test("returns missing when authorized viewing cannot be fetched", async () => {
    const result = await resolveBuyerViewingDeepLink(
      createClient({ viewingRow: null }),
      "buyer-1",
      "missing-viewing",
      [],
      {}
    );

    expect(result.resolved).toBe(false);
    expect(result.fetched).toBe(true);
  });
});
