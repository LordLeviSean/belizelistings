import {
  applySearchFilters,
  buildSearchRouterQuery,
  getActiveFilterChips,
  getDefaultSearchFilters,
  hasActiveSearchFilters,
  listingMatchesSearchQuery,
  parseSearchFiltersFromQuery,
  removeFilterChip,
  sortSearchResults,
} from "./searchFilters";

describe("searchFilters", () => {
  const sample = [
    {
      id: "1",
      status: "approved",
      title: "Beach House",
      district: "belize",
      region_slug: "belize",
      listing_type: "sale",
      price: 250000,
      beds: 3,
      baths: 2,
      verification_status: "verified",
      created_at: "2026-06-01",
    },
    {
      id: "2",
      status: "approved",
      title: "Cayo Condo",
      district: "cayo",
      listing_type: "rent",
      price: 1200,
      beds: 2,
      baths: 1,
      verification_status: "unverified",
      created_at: "2026-06-20",
    },
  ];

  test("parseSearchFiltersFromQuery reads geography hierarchy params", () => {
    const filters = parseSearchFiltersFromQuery({
      region: "cayo",
      community: "area-cayo-san-ignacio",
      locality: "loc-cayo-san-ignacio-downtown",
    });
    expect(filters.mapRegion).toBe("cayo");
    expect(filters.communityId).toBe("area-cayo-san-ignacio");
    expect(filters.localityId).toBe("loc-cayo-san-ignacio-downtown");
  });

  test("applySearchFilters respects community filter", () => {
    const rows = [
      { id: "1", map_region_slug: "cayo", community_id: "area-cayo-san-ignacio", district: "cayo" },
      { id: "2", map_region_slug: "corozal", community_id: "area-corozal-corozal", district: "corozal" },
    ];
    const filters = {
      ...getDefaultSearchFilters(),
      mapRegion: "cayo",
      communityId: "area-cayo-san-ignacio",
    };
    expect(applySearchFilters(rows, filters).map((l) => l.id)).toEqual(["1"]);
  });

  test("parseSearchFiltersFromQuery reads canonical params", () => {
    const filters = parseSearchFiltersFromQuery({
      q: "beach",
      district: "belize",
      market: "sale",
      minPrice: "100000",
      verified: "1",
      sort: "price-asc",
    });
    expect(filters.q).toBe("beach");
    expect(filters.district).toBe("belize");
    expect(filters.market).toBe("sale");
    expect(filters.minPrice).toBe("100000");
    expect(filters.verifiedOnly).toBe(true);
    expect(filters.sort).toBe("price-asc");
  });

  test("buildSearchRouterQuery omits defaults", () => {
    expect(buildSearchRouterQuery(getDefaultSearchFilters())).toEqual({});
    expect(
      buildSearchRouterQuery({ ...getDefaultSearchFilters(), q: "water", market: "rent" })
    ).toEqual({ q: "water", market: "rent" });
  });

  test("applySearchFilters combines market, query, and verified", () => {
    const filters = {
      ...getDefaultSearchFilters(),
      q: "beach",
      market: "sale",
      verifiedOnly: true,
    };
    expect(applySearchFilters(sample, filters).map((l) => l.id)).toEqual(["1"]);
  });

  test("sortSearchResults orders by price and date", () => {
    expect(sortSearchResults(sample, "price-asc").map((l) => l.id)).toEqual(["2", "1"]);
    expect(sortSearchResults(sample, "newest").map((l) => l.id)).toEqual(["2", "1"]);
  });

  test("getActiveFilterChips and removeFilterChip", () => {
    const filters = { ...getDefaultSearchFilters(), q: "cayo", market: "rent", beds: "2" };
    expect(getActiveFilterChips(filters).map((c) => c.key)).toEqual(["q", "market", "beds"]);
    const cleared = removeFilterChip(filters, "q");
    expect(cleared.q).toBe("");
    expect(hasActiveSearchFilters(cleared)).toBe(true);
  });

  test("listingMatchesSearchQuery is case-insensitive", () => {
    expect(listingMatchesSearchQuery(sample[0], "beach")).toBe(true);
    expect(listingMatchesSearchQuery(sample[0], "xyz")).toBe(false);
  });
});
