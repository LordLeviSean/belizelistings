import { getListingMarketKind } from "../utils/filterListings";

/** Canonical browse-shell market filter values (FilterBar / agent profile). */
export const LISTING_MARKET_FILTER_VALUES = Object.freeze({
  ALL: "all",
  FOR_SALE: "for-sale",
  FOR_RENT: "rent",
});

export const LISTING_MARKET_FILTER_OPTIONS = Object.freeze([
  { label: "All", value: LISTING_MARKET_FILTER_VALUES.ALL },
  { label: "For Sale", value: LISTING_MARKET_FILTER_VALUES.FOR_SALE },
  { label: "For Rent", value: LISTING_MARKET_FILTER_VALUES.FOR_RENT },
]);

/**
 * @param {string} value
 */
export function normalizeListingMarketFilterValue(value) {
  const raw = String(value || LISTING_MARKET_FILTER_VALUES.ALL).trim().toLowerCase();
  if (raw === LISTING_MARKET_FILTER_VALUES.ALL) return LISTING_MARKET_FILTER_VALUES.ALL;
  if (
    raw === LISTING_MARKET_FILTER_VALUES.FOR_RENT ||
    raw === "for-rent" ||
    raw === "for rent"
  ) {
    return LISTING_MARKET_FILTER_VALUES.FOR_RENT;
  }
  if (
    raw === LISTING_MARKET_FILTER_VALUES.FOR_SALE ||
    raw === "sale" ||
    raw === "for sale"
  ) {
    return LISTING_MARKET_FILTER_VALUES.FOR_SALE;
  }
  return LISTING_MARKET_FILTER_VALUES.ALL;
}

/**
 * @param {object[]} listings
 * @param {string} filterValue
 */
export function filterListingsByMarket(listings, filterValue) {
  const normalized = normalizeListingMarketFilterValue(filterValue);
  if (normalized === LISTING_MARKET_FILTER_VALUES.ALL) {
    return listings;
  }
  const targetKind = normalized === LISTING_MARKET_FILTER_VALUES.FOR_SALE ? "sale" : "rent";
  return listings.filter((listing) => getListingMarketKind(listing) === targetKind);
}

/**
 * Search modal/router uses `sale` instead of `for-sale`.
 * @param {string} browseValue
 */
export function listingMarketFilterToSearchMarket(browseValue) {
  const normalized = normalizeListingMarketFilterValue(browseValue);
  if (normalized === LISTING_MARKET_FILTER_VALUES.FOR_SALE) return "sale";
  if (normalized === LISTING_MARKET_FILTER_VALUES.FOR_RENT) return "rent";
  return "all";
}

/**
 * @param {string} searchMarket
 */
export function searchMarketToListingMarketFilter(searchMarket) {
  const raw = String(searchMarket || "all").trim().toLowerCase();
  if (raw === "rent" || raw === "for-rent" || raw === "for rent") {
    return LISTING_MARKET_FILTER_VALUES.FOR_RENT;
  }
  if (raw === "sale" || raw === "for-sale" || raw === "for sale") {
    return LISTING_MARKET_FILTER_VALUES.FOR_SALE;
  }
  return LISTING_MARKET_FILTER_VALUES.ALL;
}
