// src/utils/filterListings.js
import { normalizeDistrict } from "./normalize";

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

  return listings.filter((listing) => {
    // 📍 District filter
    if (district && normalizeDistrict(listing.district) !== normalizeDistrict(district)) {
      return false;
    }

    // 🏷 Listing type filter
    if (status !== "all" && listing.listing_type !== status) {
      return false;
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

    // 🛏 Beds
    if (beds !== null && listing.beds < Number(beds)) {
      return false;
    }

    // 🛁 Baths
    if (baths !== null && listing.baths < Number(baths)) {
      return false;
    }

    return true;
  });
}
