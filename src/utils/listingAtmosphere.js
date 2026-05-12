/**
 * Subtle environmental atmosphere keys for listing detail immersion (CSS-driven).
 */
export function getListingAtmosphereKey(listing = {}) {
  const slug = String(listing?.district || listing?.region_slug || listing?.subregion_slug || "").toLowerCase();
  const title = String(listing?.title || "").toLowerCase();
  const amenityBlob = Array.isArray(listing?.amenities)
    ? listing.amenities.join(" ").toLowerCase()
    : "";
  const desc = String(listing?.description || listing?.features || "").toLowerCase();
  const blob = `${slug} ${title} ${desc} ${amenityBlob}`;

  if (/(beach|ocean|sea|caye|coast|shore|ambergris|placencia|waterview|waterfront)/.test(blob)) {
    return "coastal";
  }
  if (/(jungle|rainforest|forest|mountain|pine|ridge|san ignacio|mountain pine)/.test(blob)) {
    return "jungle";
  }
  if (/(condo|penthouse|highrise|spa|resort|luxury apartment)/.test(blob)) {
    return "luxury";
  }
  if (/(island|atoll|private island|caye chapel)/.test(blob)) {
    return "island";
  }
  const pt = String(listing?.property_type || "").toLowerCase();
  if (pt === "condo" || pt === "apartment") return "urban";
  return "default";
}
