import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { resolveCanonicalListingMarketType } from "@/lib/listingMarketType";

const SALE_COMPLETION = Object.freeze({
  marketType: "sale",
  targetStatus: "sold",
  targetLifecycle: LISTING_LIFECYCLE.RECENTLY_SOLD,
  ownershipAction: OWNERSHIP_ACTIONS.CLOSE_SOLD,
  label: "Mark Sold",
  confirmationTitle: "Mark this listing as sold?",
  confirmationBody:
    "This will remove the property from active sale listings and show it as Sold.",
  confirmationPrimaryLabel: "Mark Sold",
  successMessage: "Listing marked as sold.",
  notificationMessage: "Your listing has been marked as sold.",
  resultBadgeLabel: "Sold",
  buttonVariant: "sold",
});

const RENT_COMPLETION = Object.freeze({
  marketType: "rent",
  targetStatus: "rented",
  targetLifecycle: LISTING_LIFECYCLE.RECENTLY_RENTED,
  ownershipAction: OWNERSHIP_ACTIONS.CLOSE_RENTED,
  label: "Mark Rented",
  confirmationTitle: "Mark this listing as rented?",
  confirmationBody:
    "This will remove the property from active rental listings and show it as Rented.",
  confirmationPrimaryLabel: "Mark Rented",
  successMessage: "Listing marked as rented.",
  notificationMessage: "Your listing has been marked as rented.",
  resultBadgeLabel: "Rented",
  buttonVariant: "rented",
});

/**
 * Shared resolver for owner completion actions across dashboards.
 * @param {object} listing
 * @returns {typeof SALE_COMPLETION | typeof RENT_COMPLETION | null}
 */
export function resolveListingCompletionAction(listing) {
  const marketType = resolveCanonicalListingMarketType(listing);
  if (marketType === "rent") return RENT_COMPLETION;
  if (marketType === "sale") return SALE_COMPLETION;
  return null;
}

/**
 * @param {object} styles Dashboard.module.css import
 * @param {"sold"|"rented"} buttonVariant
 */
export function resolveListingCompletionButtonClassName(styles, buttonVariant) {
  if (!styles) return "";
  return buttonVariant === "rented" ? styles.listingActionRented : styles.listingActionSold;
}

/**
 * @param {object} listing
 * @param {string} ownershipAction
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function validateListingCompletionOwnershipAction(listing, ownershipAction) {
  const completion = resolveListingCompletionAction(listing);
  if (!completion) {
    return { ok: false, code: "market_unknown" };
  }
  if (ownershipAction !== completion.ownershipAction) {
    return { ok: false, code: "completion_market_mismatch" };
  }
  return { ok: true };
}

/**
 * Mirrors DB guard for owner lifecycle patches.
 * @param {object} listing
 * @param {string} targetLifecycle
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function validateListingCompletionLifecyclePatch(listing, targetLifecycle) {
  const completion = resolveListingCompletionAction(listing);
  if (!completion) {
    return { ok: false, code: "market_unknown" };
  }
  if (targetLifecycle !== completion.targetLifecycle) {
    return { ok: false, code: "completion_market_mismatch" };
  }
  return { ok: true };
}

/**
 * @param {object} listing
 * @param {string} [context]
 */
export function warnMissingListingMarketType(listing, context = "listing-completion") {
  if (typeof console === "undefined" || process.env.NODE_ENV === "production") return;
  const id = listing?.id ?? "unknown";
  console.warn(`[${context}] missing canonical listing_type/market_type for listing ${id}`);
}
