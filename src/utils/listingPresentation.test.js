import { isLandInventoryListing, normalizePropertyTypeKey } from "./listingPresentation";

describe("listingPresentation", () => {
  test("normalizePropertyTypeKey", () => {
    expect(normalizePropertyTypeKey("  Land ")).toBe("land");
    expect(normalizePropertyTypeKey("LOT")).toBe("lot");
  });

  test("isLandInventoryListing by property_type", () => {
    expect(isLandInventoryListing({ property_type: "land" })).toBe(true);
    expect(isLandInventoryListing({ property_type: "lot" })).toBe(true);
    expect(isLandInventoryListing({ property_type: "parcel" })).toBe(true);
    expect(isLandInventoryListing({ property_type: "house" })).toBe(false);
    expect(isLandInventoryListing({ type: "land" })).toBe(true);
  });

  test("isLandInventoryListing by listing_type / market_type / category when set", () => {
    expect(isLandInventoryListing({ property_type: "house", listing_type: "land" })).toBe(true);
    expect(isLandInventoryListing({ property_type: "", market_type: "lot" })).toBe(true);
    expect(isLandInventoryListing({ category: "parcel" })).toBe(true);
    expect(isLandInventoryListing({ listing_type: "sale", property_type: "condo" })).toBe(false);
  });

  test("compound type strings", () => {
    expect(isLandInventoryListing({ property_type: "vacant_land" })).toBe(true);
  });
});
