// src/utils/filterListings.js
import { isChildRegion, normalizeRegionSlug } from "../constants/geographyLayer";
import { resolveListingMarketKindForBrowse } from "../lib/listingMarketType";
import { getListingRegionSlug, isListingActivelyAvailable } from "./canonicalListing";
import { isLandInventoryListing } from "./listingPresentation";

/** Canonical sale/rent kind for filter matching (UI uses `for-sale` / `rent`). */
export function getListingMarketKind(listing) {
  return resolveListingMarketKindForBrowse(listing);
}

function normalizeFilterMarketStatus(status) {
  const raw = String(status || "all").trim().toLowerCase();
  if (raw === "all") return "all";
  if (raw === "rent" || raw === "for-rent" || raw === "for rent") return "rent";
  if (raw === "sale" || raw === "for-sale" || raw === "for sale") return "sale";
  return raw;
}

export function filterListings(listings, filters = {}) {
  const {
    district = null,
    status = "all",
    // support both names (UI uses minPrice/maxPrice)
    priceMin = null,
    priceMax = null,
    minPrice = null,
    maxPrice = null,
    beds = null,
    baths = null,
  } = filters;

  const marketFilter = normalizeFilterMarketStatus(status);

  return listings.filter((listing) => {
    // Region-aware filter with child-region continuity.
    if (district) {
      const listingRegion = normalizeRegionSlug(getListingRegionSlug(listing));
      const targetRegion = normalizeRegionSlug(district);
      if (listingRegion !== targetRegion && !isChildRegion(listingRegion, targetRegion)) {
        return false;
      }
    }

    // Listing type filter — UI sends `for-sale`; rows may store `sale`.
    // Active For Sale / For Rent excludes recently closed; "all" keeps them browsable.
    if (marketFilter !== "all") {
      if (getListingMarketKind(listing) !== marketFilter) {
        return false;
      }
      if (!isListingActivelyAvailable(listing)) {
        return false;
      }
    }

    // 💰 Price min
    const effectiveMinPrice = priceMin ?? minPrice;
    if (effectiveMinPrice !== null && listing.price < Number(effectiveMinPrice)) {
      return false;
    }

    // 💰 Price max
    const effectiveMaxPrice = priceMax ?? maxPrice;
    if (effectiveMaxPrice !== null && listing.price > Number(effectiveMaxPrice)) {
      return false;
    }

    // 🛏 Beds / 🛁 Baths — land inventory has no residential room counts; do not filter out by bd/ba
    if (!isLandInventoryListing(listing)) {
      if (beds !== null && listing.beds < Number(beds)) {
        return false;
      }
      if (baths !== null && listing.baths < Number(baths)) {
        return false;
      }
    }

    return true;
  });
}
