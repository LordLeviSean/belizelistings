import { buildCreateListingPayload } from "./listingPersistence";

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
  });
});
