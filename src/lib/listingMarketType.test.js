/** @jest-environment node */

import {
  resolveCanonicalListingMarketType,
  resolveListingMarketKindForBrowse,
} from "@/lib/listingMarketType";

describe("listingMarketType", () => {
  test("listing_type rent is authoritative", () => {
    expect(resolveCanonicalListingMarketType({ listing_type: "rent" })).toBe("rent");
    expect(resolveCanonicalListingMarketType({ listing_type: "sale" })).toBe("sale");
  });

  test("does not infer market from property_type or title", () => {
    expect(
      resolveCanonicalListingMarketType({
        property_type: "rental",
        title: "For Rent downtown",
      })
    ).toBeNull();
  });

  test("browse fallback still resolves legacy rows", () => {
    expect(resolveListingMarketKindForBrowse({ listing_type: "for-rent" })).toBe("rent");
  });
});
