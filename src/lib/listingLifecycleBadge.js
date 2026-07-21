import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { resolveCanonicalListingMarketType } from "@/lib/listingMarketType";
import { getLifecycleStatus } from "@/utils/canonicalListing";

export const LISTING_BADGE_VARIANT = Object.freeze({
  SALE: "sale",
  RENT: "rent",
  SOLD: "sold",
  RENTED: "rented",
});

/**
 * Shared lifecycle badge resolver for cards, detail surfaces, and previews.
 * @param {object} listing
 * @returns {{ label: string, variant: string }}
 */
export function resolveListingLifecycleBadge(listing) {
  const lc = getLifecycleStatus(listing);
  if (lc === LISTING_LIFECYCLE.RECENTLY_SOLD || lc === LISTING_LIFECYCLE.SOLD) {
    return { label: "Sold", variant: LISTING_BADGE_VARIANT.SOLD };
  }
  if (lc === LISTING_LIFECYCLE.RECENTLY_RENTED || lc === LISTING_LIFECYCLE.RENTED) {
    return { label: "Rented", variant: LISTING_BADGE_VARIANT.RENTED };
  }
  const market = resolveCanonicalListingMarketType(listing);
  if (market === "rent") {
    return { label: "For Rent", variant: LISTING_BADGE_VARIANT.RENT };
  }
  return { label: "For Sale", variant: LISTING_BADGE_VARIANT.SALE };
}
