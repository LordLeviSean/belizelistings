/**
 * Shared presentation rules for inventory type (land vs residential).
 * Used by cards, create preview, intel — keep detection aligned across `property_type` and related fields.
 */

const LAND_PROPERTY_TYPES = new Set(["land", "lot", "parcel"]);

export function normalizePropertyTypeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function rawValueMatchesLandInventory(raw) {
  if (raw == null || raw === "") return false;
  const pt = normalizePropertyTypeKey(raw);
  if (LAND_PROPERTY_TYPES.has(pt)) return true;
  const segments = pt.split(/[_\s-]+/).filter(Boolean);
  return segments.some((s) => LAND_PROPERTY_TYPES.has(s));
}

/**
 * True when the listing should use land presentation (no bd/ba, land glyph, calmer intel).
 * Any of these may carry land / lot / parcel in legacy or normalized rows:
 * `property_type`, `type`, `listing_type`, `market_type`, `category`, etc.
 */
export function isLandInventoryListing(listing = {}) {
  const candidates = [
    listing.property_type,
    listing.type,
    listing.listing_type,
    listing.market_type,
    listing.category,
    listing.normalized_listing_type,
    listing.inventory_type,
    listing.listing_category,
  ];
  return candidates.some(rawValueMatchesLandInventory);
}
