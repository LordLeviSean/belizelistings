/**
 * Canonical sale/rent market type from listing rows.
 * Authoritative fields: `listing_type` (primary), `market_type` (secondary).
 * Does not infer from title, description, or property_type.
 *
 * @param {object} listing
 * @returns {"sale"|"rent"|null}
 */
export function resolveCanonicalListingMarketType(listing) {
  const listingType = String(listing?.listing_type ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (listingType === "rent" || listingType === "rental" || listingType === "lease") {
    return "rent";
  }
  if (
    listingType === "sale" ||
    listingType === "sell" ||
    listingType === "for-sale" ||
    listingType === "forsale"
  ) {
    return "sale";
  }

  const marketType = String(listing?.market_type ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (marketType === "rent" || marketType === "rental" || marketType === "lease") {
    return "rent";
  }
  if (marketType === "sale" || marketType === "for-sale" || marketType === "forsale") {
    return "sale";
  }

  const legacySignals = [listing?.listing_status, listing?.category]
    .map((value) => normalizeMarketToken(value))
    .filter(Boolean);

  for (const signal of legacySignals) {
    if (
      signal === "rent" ||
      signal === "rental" ||
      signal === "lease" ||
      signal === "for-rent" ||
      signal === "for rent"
    ) {
      return "rent";
    }
    if (
      signal === "sale" ||
      signal === "sell" ||
      signal === "for-sale" ||
      signal === "for sale" ||
      signal === "forsale"
    ) {
      return "sale";
    }
  }

  return null;
}

function normalizeMarketToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/**
 * Browse/search fallback when canonical market is absent (legacy rows).
 * @param {object} listing
 * @returns {"sale"|"rent"}
 */
export function resolveListingMarketKindForBrowse(listing) {
  const canonical = resolveCanonicalListingMarketType(listing);
  if (canonical) return canonical;

  const signals = [
    listing?.listing_type,
    listing?.market_type,
    listing?.listing_status,
    listing?.status,
    listing?.category,
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean)
    .join(" ");

  if (/(rent|rental|lease|for-rent|for rent)/.test(signals)) return "rent";
  if (/(sale|sell|for-sale|for sale)/.test(signals)) return "sale";
  return "sale";
}
