import {
  buildCreateListingPayload,
  buildDraftAutosavePayload,
  buildDraftListingPayload,
  buildSubmitForReviewPatch,
  DRAFT_INSERT_PAYLOAD_OMIT_KEYS,
  resolveListingDistrictSlug,
  validateListingDraftContract,
} from "./listingPersistence";
import { LISTING_WRITE_MAX_PATHS } from "./listingWriteContract";

describe("listingPersistence write contract integration", () => {
  test("safe insert path budget matches global write contract (max 2)", () => {
    expect(LISTING_WRITE_MAX_PATHS).toBe(2);
  });
});

describe("listingPersistence buildCreateListingPayload", () => {
  test("structured geography preserved in create payload", () => {
    const p = buildCreateListingPayload({
      form: {
        map_region_slug: "stann-creek",
        highway_id: "highway-hummingbird-highway",
        highway_mile: "12",
        title: "t",
        price: 1,
        property_type: "land",
        listing_type: "sale",
        beds: 0,
        baths: 0,
      },
      authUserId: "u1",
    });
    expect(p.map_region_slug).toBe("stann-creek");
    expect(p.highway_id).toBe("highway-hummingbird-highway");
    expect(p.highway_mile).toBe(12);
    expect(p.community_id).toBeNull();
  });

  test("parent region only: Belize", () => {
    const p = buildCreateListingPayload({
      form: { district: "Belize", title: "t", price: 1, property_type: "house", listing_type: "sale", beds: 0, baths: 0 },
      authUserId: "u1",
    });
    expect(p.region_slug).toBe("belize");
    expect(p.subregion_slug).toBeNull();
    expect(p.district).toBe("belize");
  });

  test("subregion: San Pedro → parent region_slug + subregion_slug", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "San Pedro",
        title: "t",
        price: 1,
        property_type: "house",
        listing_type: "sale",
        beds: 0,
        baths: 0,
      },
      authUserId: "u1",
    });
    expect(p.region_slug).toBe("ambergris-caye");
    expect(p.subregion_slug).toBe("san-pedro");
    expect(p.district).toBe("san-pedro");
  });

  test("Caye Caulker: selectable region (not subregion type) stays on region_slug", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Caye Caulker",
        title: "t",
        price: 1,
        property_type: "land",
        listing_type: "sale",
        beds: 0,
        baths: 0,
      },
      authUserId: "u1",
    });
    expect(p.region_slug).toBe("caye-caulker");
    expect(p.subregion_slug).toBeNull();
    expect(p.district).toBe("caye-caulker");
    expect(p.beds).toBeNull();
    expect(p.baths).toBeNull();
    expect(p.garage).toBeNull();
  });

  test("includes trimmed description when provided", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "land",
        listing_type: "sale",
        beds: 0,
        baths: 0,
        description: "  Coastal parcel  ",
      },
      authUserId: "u1",
    });
    expect(p.description).toBe("Coastal parcel");
  });

  test("sends null description when empty or whitespace", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "house",
        listing_type: "sale",
        beds: 1,
        baths: 1,
        description: "   ",
      },
      authUserId: "u1",
    });
    expect(p.description).toBeNull();
  });

  test("persists amenities as TEXT[] payload and mirrors features CSV", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "house",
        listing_type: "sale",
        beds: 1,
        baths: 1,
        amenities: ["Pool", "Sea view"],
        legacyFeaturesTail: "",
      },
      authUserId: "u1",
    });
    expect(p.amenities).toEqual(["Sea view", "Pool"]);
    expect(p.features).toBe("Sea view, Pool");
  });

  test("create payload omits unapplied occupancy enrichment columns", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "house",
        listing_type: "sale",
        beds: 0,
        baths: 0,
      },
      authUserId: "u1",
    });
    expect(p.occupied_at).toBeUndefined();
    expect(p.occupancy_status).toBeUndefined();
  });

  test("legacy tail merges with amenities in features string", () => {
    const p = buildCreateListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "land",
        listing_type: "sale",
        beds: 0,
        baths: 0,
        amenities: ["Road access"],
        legacyFeaturesTail: "Older freeform note",
      },
      authUserId: "u1",
    });
    expect(p.amenities).toEqual(["Road access"]);
    expect(p.features).toBe("Older freeform note, Road access");
  });
});

describe("listingPersistence district contract", () => {
  test("resolveListingDistrictSlug: label, region_slug, subregion_slug", () => {
    expect(resolveListingDistrictSlug({ district: "Belize City" })).toBe("belize-city");
    expect(resolveListingDistrictSlug({ region_slug: "ambergris-caye" })).toBe("ambergris-caye");
    expect(resolveListingDistrictSlug({ subregion_slug: "san-pedro" })).toBe("san-pedro");
  });

  test("validateListingDraftContract rejects missing structured geography", () => {
    const v = validateListingDraftContract({
      form: { property_type: "house", listing_type: "sale" },
      authUserId: "u1",
    });
    expect(v.ok).toBe(false);
    expect(v.errors.map_region_slug).toBeTruthy();
  });

  test("validateListingDraftContract accepts structured geography", () => {
    const v = validateListingDraftContract({
      form: {
        map_region_slug: "belize",
        community_id: "area-belize-belize-city",
        property_type: "house",
        listing_type: "sale",
      },
      authUserId: "u1",
    });
    expect(v.ok).toBe(true);
    expect(v.district).toBeTruthy();
  });
});

describe("listingPersistence buildSubmitForReviewPatch", () => {
  test("pending review patch omits user_id and unapplied occupancy columns", () => {
    const p = buildSubmitForReviewPatch({
      form: {
        district: "Belize",
        title: "Ready",
        price: 250000,
        property_type: "house",
        listing_type: "sale",
        beds: 2,
        baths: 1,
      },
      authUserId: "u1",
    });
    expect(p.user_id).toBeUndefined();
    expect(p.listed_by).toBeUndefined();
    expect(p.managed_by).toBeUndefined();
    expect(p.region_slug).toBeUndefined();
    expect(p.subregion_slug).toBeUndefined();
    expect(p.occupied_at).toBeUndefined();
    expect(p.occupancy_status).toBeUndefined();
    expect(p.vacancy_status).toBeUndefined();
    expect(p.vacated_at).toBeUndefined();
    expect(p.maintenance_hold).toBeUndefined();
    expect(p.seasonal_hold).toBeUndefined();
    expect(p.status).toBe("pending");
    expect(p.lifecycle_status).toBe("submitted");
    expect(p.moderation_status).toBe("pending_review");
    expect(p.title).toBe("Ready");
  });
});

describe("listingPersistence buildDraftListingPayload", () => {
  test("draft insert omits lifecycle, audit, role, and slug enrichment", () => {
    const p = buildDraftListingPayload({
      form: {
        district: "San Pedro",
        title: "Draft",
        price: 100,
        property_type: "house",
        listing_type: "sale",
        beds: 2,
        baths: 1,
        description: "Notes",
      },
      authUserId: "u1",
    });
    for (const key of DRAFT_INSERT_PAYLOAD_OMIT_KEYS) {
      expect(p[key]).toBeUndefined();
    }
    expect(p.status).toBe("draft");
    expect(p.user_id).toBe("u1");
    expect(p.district).toBe("san-pedro");
    expect(p.title).toBe("Draft");
    expect(p.description).toBe("Notes");
    expect(p.beds).toBe(2);
    expect(p.baths).toBe(1);
  });

  test("draft insert keys are a superset of minimal-safe insert core", () => {
    const p = buildDraftListingPayload({
      form: {
        district: "Belize",
        title: "t",
        price: 1,
        property_type: "house",
        listing_type: "sale",
        beds: 0,
        baths: 0,
      },
      authUserId: "u1",
    });
    const keys = Object.keys(p).sort();
    expect(keys).toEqual(
      [
        "amenities",
        "baths",
        "beds",
        "community_id",
        "description",
        "district",
        "features",
        "highway_id",
        "highway_mile",
        "listing_type",
        "locality_id",
        "locality_not_listed_text",
        "map_region_slug",
        "price",
        "property_type",
        "status",
        "title",
        "user_id",
      ].sort()
    );
  });
});

describe("listingPersistence buildDraftAutosavePayload", () => {
  test("includes description in draft autosave payload", () => {
    const p = buildDraftAutosavePayload({
      form: {
        district: "Belize",
        title: "Draft",
        price: 100,
        property_type: "land",
        listing_type: "sale",
        beds: "",
        baths: "",
        description: "Autosave body",
      },
      authUserId: "u1",
    });
    expect(p.description).toBe("Autosave body");
  });

  test("preserves archived lifecycle when editing archived inventory", () => {
    const p = buildDraftAutosavePayload({
      form: {
        district: "Belize",
        title: "Archived edit",
        price: 200,
        property_type: "house",
        listing_type: "sale",
        beds: "2",
        baths: "1",
        description: "Still archived",
      },
      authUserId: "u1",
      sourceLifecycle: "archived",
    });
    expect(p.status).toBe("archived");
    expect(p.lifecycle_status).toBe("archived");
    expect(p.moderation_status).toBe("archived");
  });

  test("preserves published lifecycle when editing live inventory", () => {
    const p = buildDraftAutosavePayload({
      form: {
        district: "Belize",
        title: "Live edit",
        price: 300,
        property_type: "house",
        listing_type: "sale",
        beds: "3",
        baths: "2",
        description: "Updated copy",
      },
      authUserId: "u1",
      sourceLifecycle: "approved",
    });
    expect(p.status).toBeUndefined();
    expect(p.lifecycle_status).toBeUndefined();
    expect(p.description).toBe("Updated copy");
  });
});
