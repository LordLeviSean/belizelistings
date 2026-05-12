import {
  amenitiesFromListingRow,
  canonicalizeAmenityToken,
  sanitizeAmenitiesArray,
  splitLegacyFeaturesString,
} from "./listingAmenities";

describe("listingAmenities", () => {
  test("canonicalizeAmenityToken normalizes case and spacing", () => {
    expect(canonicalizeAmenityToken("  sea VIEW ")).toBe("Sea view");
    expect(canonicalizeAmenityToken("nope")).toBeNull();
  });

  test("splitLegacyFeaturesString separates known chips and freeform", () => {
    const { matched, unmatchedParts } = splitLegacyFeaturesString("Pool, random note, Dock");
    expect(matched).toEqual(["Pool", "Dock"]);
    expect(unmatchedParts).toEqual(["random note"]);
  });

  test("amenitiesFromListingRow prefers amenities array over features", () => {
    const row = { amenities: ["Pool", "Solar"], features: "orphan text" };
    expect(amenitiesFromListingRow(row)).toEqual({
      amenities: ["Pool", "Solar"],
      legacyFeaturesTail: "",
    });
  });

  test("amenitiesFromListingRow parses legacy features when amenities empty", () => {
    const row = { features: "Gated, custom buyer note" };
    expect(amenitiesFromListingRow(row)).toEqual({
      amenities: ["Gated"],
      legacyFeaturesTail: "custom buyer note",
    });
  });

  test("sanitizeAmenitiesArray orders by catalog and drops unknown", () => {
    expect(sanitizeAmenitiesArray(["Solar", "Pool", "bogus"])).toEqual(["Pool", "Solar"]);
  });
});
