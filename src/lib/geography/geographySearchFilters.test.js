import {
  geographyFilterChipLabels,
  listingMatchesGeographyFilters,
  resolveListingGeographyFields,
} from "./geographySearchFilters";

describe("geographySearchFilters", () => {
  test("resolveListingGeographyFields prefers V1 columns", () => {
    const fields = resolveListingGeographyFields({
      map_region_slug: "cayo",
      community_id: "area-cayo-san-ignacio",
      locality_id: "loc-cayo-san-ignacio-downtown",
    });
    expect(fields.map_region_slug).toBe("cayo");
    expect(fields.community_id).toBe("area-cayo-san-ignacio");
    expect(fields.locality_id).toBe("loc-cayo-san-ignacio-downtown");
  });

  test("community filter matches structured listing", () => {
    const listing = {
      map_region_slug: "cayo",
      community_id: "area-cayo-san-ignacio",
      district: "cayo",
      subregion_slug: "san-ignacio",
    };
    expect(
      listingMatchesGeographyFilters(listing, { mapRegion: "cayo", communityId: "area-cayo-san-ignacio" })
    ).toBe(true);
    expect(
      listingMatchesGeographyFilters(listing, { mapRegion: "cayo", communityId: "area-cayo-belmopan" })
    ).toBe(false);
  });

  test("legacy district URL still matches partial listings", () => {
    const listing = { district: "corozal", region_slug: "corozal" };
    expect(listingMatchesGeographyFilters(listing, { district: "corozal" })).toBe(true);
  });

  test("chip labels use human names not slugs", () => {
    const chips = geographyFilterChipLabels({
      mapRegion: "cayo",
      communityId: "area-cayo-san-ignacio",
    });
    expect(chips.some((c) => c.key === "mapRegion" && c.label === "Cayo")).toBe(true);
    expect(chips.some((c) => c.key === "communityId" && c.label === "San Ignacio")).toBe(true);
  });
});
