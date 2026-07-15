import { mapLegacyListingToGeography, validateGeographyForm } from "./legacyGeoBackfill";
import { validateListingDraftContract } from "../listingPersistence";

describe("mapLegacyListingToGeography", () => {
  test("routes Toledo Santa Elena to area-toledo-santa-elena, not Cayo", () => {
    const result = mapLegacyListingToGeography({
      region_slug: "toledo",
      subregion_slug: "santa-elena",
    });
    expect(result.map_region_slug).toBe("toledo");
    expect(result.community_id).toBe("area-toledo-santa-elena");
    expect(result.geo_backfill_status).toBe("exact");
  });

  test("routes Cayo Santa Elena to area-cayo-santa-elena", () => {
    const result = mapLegacyListingToGeography({
      region_slug: "cayo",
      subregion_slug: "santa-elena",
    });
    expect(result.map_region_slug).toBe("cayo");
    expect(result.community_id).toBe("area-cayo-santa-elena");
  });

  test("routes Corozal San Pedro distinctly from Ambergris San Pedro", () => {
    const result = mapLegacyListingToGeography({
      region_slug: "corozal",
      subregion_slug: "san-pedro",
    });
    expect(result.map_region_slug).toBe("corozal");
    expect(result.community_id).toBe("area-corozal-san-pedro");
  });

  test("routes Ambergris San Pedro to area-ambergris-caye-san-pedro", () => {
    const result = mapLegacyListingToGeography({
      region_slug: "ambergris-caye",
      subregion_slug: "san-pedro",
    });
    expect(result.map_region_slug).toBe("ambergris-caye");
    expect(result.community_id).toBe("area-ambergris-caye-san-pedro");
  });
});

describe("validateGeographyForm", () => {
  test("rejects legacy district-only prefill without structured geography", () => {
    const result = validateGeographyForm({
      district: "Cayo",
      property_type: "house",
      title: "x",
      price: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map_region_slug).toBeTruthy();
    expect(result.errors.community_id).toBeUndefined();
  });

  test("accepts full structured geography", () => {
    const result = validateGeographyForm({
      map_region_slug: "cayo",
      community_id: "area-cayo-san-ignacio",
      locality_id: "loc-cayo-san-ignacio-maya-vista",
    });
    expect(result.ok).toBe(true);
  });

  test("allows optional highway mile", () => {
    const result = validateGeographyForm({
      map_region_slug: "stann-creek",
      highway_id: "highway-hummingbird-highway",
      highway_mile: "",
    });
    expect(result.ok).toBe(true);
  });

  test("rejects invalid highway mile when provided", () => {
    const result = validateGeographyForm({
      map_region_slug: "stann-creek",
      highway_id: "highway-hummingbird-highway",
      highway_mile: "not-a-number",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.highway_mile).toBeTruthy();
  });
});

describe("validateListingDraftContract geography gate", () => {
  test("blocks URL-style district prefill without map region and community", () => {
    const v = validateListingDraftContract({
      form: {
        district: "cayo",
        property_type: "house",
        listing_type: "sale",
        title: "x",
        price: 1,
      },
      authUserId: "u1",
    });
    expect(v.ok).toBe(false);
    expect(v.errors.map_region_slug).toBeTruthy();
  });
});
