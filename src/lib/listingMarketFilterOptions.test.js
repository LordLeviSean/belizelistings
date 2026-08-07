/** @jest-environment node */

import {
  filterListingsByMarket,
  listingMarketFilterToSearchMarket,
  LISTING_MARKET_FILTER_VALUES,
  normalizeListingMarketFilterValue,
  searchMarketToListingMarketFilter,
} from "./listingMarketFilterOptions";

describe("listingMarketFilterOptions", () => {
  test("normalizes sale aliases to for-sale", () => {
    expect(normalizeListingMarketFilterValue("sale")).toBe(
      LISTING_MARKET_FILTER_VALUES.FOR_SALE
    );
    expect(normalizeListingMarketFilterValue("for-sale")).toBe(
      LISTING_MARKET_FILTER_VALUES.FOR_SALE
    );
  });

  test("filters listings by market kind", () => {
    const listings = [
      { id: 1, listing_type: "sale" },
      { id: 2, listing_type: "rent" },
    ];
    expect(filterListingsByMarket(listings, "for-sale")).toHaveLength(1);
    expect(filterListingsByMarket(listings, "rent")[0].id).toBe(2);
    expect(filterListingsByMarket(listings, "all")).toHaveLength(2);
  });

  test("converts browse and search market values", () => {
    expect(listingMarketFilterToSearchMarket("for-sale")).toBe("sale");
    expect(searchMarketToListingMarketFilter("sale")).toBe(
      LISTING_MARKET_FILTER_VALUES.FOR_SALE
    );
  });
});
