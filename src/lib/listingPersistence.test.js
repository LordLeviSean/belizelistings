import { buildCreateListingPayload, buildDraftAutosavePayload } from "./listingPersistence";

describe("listingPersistence buildCreateListingPayload", () => {
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
});
