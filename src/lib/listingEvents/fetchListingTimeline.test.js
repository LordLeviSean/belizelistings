import { fetchListingTimeline } from "./fetchListingTimeline";

jest.mock("../featureFlags", () => ({
  BL_ENABLE_LISTING_EVENTS: true,
}));

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from "../supabaseClient";

function mockTimelineQuery({ data = [], error = null } = {}) {
  const limit = jest.fn().mockResolvedValue({ data, error });
  const order = jest.fn(() => ({ limit }));
  const eqVisibility = jest.fn(() => ({ order }));
  const eqListingId = jest.fn(() => ({ eq: eqVisibility }));
  const select = jest.fn(() => ({ eq: eqListingId }));
  supabase.from.mockReturnValue({ select });
  return { eqListingId, eqVisibility };
}

describe("fetchListingTimeline", () => {
  beforeEach(() => {
    supabase.from.mockReset();
  });

  test("returns skipped when feature flag off", async () => {
    jest.resetModules();
    jest.doMock("../featureFlags", () => ({ BL_ENABLE_LISTING_EVENTS: false }));
    const { fetchListingTimeline: fetchOff } = await import("./fetchListingTimeline");
    const result = await fetchOff("42");
    expect(result.skipped).toBe(true);
    expect(result.events).toEqual([]);
  });

  test("queries listing_id as number for bigint production schema", async () => {
    const chain = mockTimelineQuery({ data: [{ id: "evt-1", event_type: "listing.created" }] });
    const result = await fetchListingTimeline("12345");
    expect(supabase.from).toHaveBeenCalledWith("listing_events");
    expect(chain.eqListingId).toHaveBeenCalledWith("listing_id", 12345);
    expect(chain.eqVisibility).toHaveBeenCalledWith("visibility", "public");
    expect(result.events).toHaveLength(1);
    expect(result.error).toBeNull();
  });

  test("returns error for missing listingId", async () => {
    const result = await fetchListingTimeline("");
    expect(result.events).toEqual([]);
    expect(result.error?.message).toBe("Missing listingId");
  });
});
