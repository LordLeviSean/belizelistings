import {
  AGENT_ACTIVE_LISTING_CAP,
  PUBLIC_USER_ACTIVE_LISTING_CAP,
  BROKERAGE_ACTIVE_LISTING_CAP,
  resolveTierActiveListingCap,
} from "./listingTierCaps";

export const LISTING_LIFECYCLE = Object.freeze({
  DRAFT: "draft",
  PENDING_REVIEW: "pending",
  VERIFIED: "verified",
  PUBLISHED: "approved",
  RECENTLY_SOLD: "recently_sold",
  RECENTLY_RENTED: "recently_rented",
  RENTED: "rented",
  SOLD: "sold",
  ARCHIVED: "archived",
  REJECTED: "rejected",
  EXPIRED: "expired",
});

const LIFECYCLE_LABELS = Object.freeze({
  [LISTING_LIFECYCLE.DRAFT]: "Draft",
  [LISTING_LIFECYCLE.PENDING_REVIEW]: "Pending Review",
  [LISTING_LIFECYCLE.VERIFIED]: "Verified",
  [LISTING_LIFECYCLE.PUBLISHED]: "Published",
  [LISTING_LIFECYCLE.RECENTLY_SOLD]: "Sold",
  [LISTING_LIFECYCLE.RECENTLY_RENTED]: "Rented",
  [LISTING_LIFECYCLE.RENTED]: "Rented",
  [LISTING_LIFECYCLE.SOLD]: "Sold",
  [LISTING_LIFECYCLE.ARCHIVED]: "Archived",
  [LISTING_LIFECYCLE.REJECTED]: "Rejected",
  [LISTING_LIFECYCLE.EXPIRED]: "Expired",
});

const LIFECYCLE_ALIASES = new Map([
  ["published", LISTING_LIFECYCLE.PUBLISHED],
  ["approved", LISTING_LIFECYCLE.PUBLISHED],
  ["pending-review", LISTING_LIFECYCLE.PENDING_REVIEW],
  ["pending_review", LISTING_LIFECYCLE.PENDING_REVIEW],
  ["pending", LISTING_LIFECYCLE.PENDING_REVIEW],
  ["submitted", LISTING_LIFECYCLE.PENDING_REVIEW],
  ["verify", LISTING_LIFECYCLE.VERIFIED],
  ["verified", LISTING_LIFECYCLE.VERIFIED],
  ["rent", LISTING_LIFECYCLE.RENTED],
  ["rented", LISTING_LIFECYCLE.RENTED],
  ["recently_rented", LISTING_LIFECYCLE.RECENTLY_RENTED],
  ["recently-rented", LISTING_LIFECYCLE.RECENTLY_RENTED],
  ["sale", LISTING_LIFECYCLE.SOLD],
  ["sold", LISTING_LIFECYCLE.SOLD],
  ["recently_sold", LISTING_LIFECYCLE.RECENTLY_SOLD],
  ["recently-sold", LISTING_LIFECYCLE.RECENTLY_SOLD],
  ["archived", LISTING_LIFECYCLE.ARCHIVED],
  ["rejected", LISTING_LIFECYCLE.REJECTED],
  ["expired", LISTING_LIFECYCLE.EXPIRED],
  ["draft", LISTING_LIFECYCLE.DRAFT],
]);

function toKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function normalizeLifecycleStatus(value) {
  return LIFECYCLE_ALIASES.get(toKey(value)) || LISTING_LIFECYCLE.DRAFT;
}

export function getLifecycleLabel(value) {
  const normalized = normalizeLifecycleStatus(value);
  return LIFECYCLE_LABELS[normalized] || "Draft";
}

export function getArchiveStatus() {
  return LISTING_LIFECYCLE.ARCHIVED;
}

export function getRepublishStatus() {
  return LISTING_LIFECYCLE.PENDING_REVIEW;
}

export function getModerationStatus(action) {
  const normalized = toKey(action);
  if (normalized === "approve" || normalized === "approved" || normalized === "publish") {
    return LISTING_LIFECYCLE.PUBLISHED;
  }
  if (normalized === "reject" || normalized === "rejected") {
    return LISTING_LIFECYCLE.REJECTED;
  }
  return LISTING_LIFECYCLE.PENDING_REVIEW;
}

export const PLATFORM_TIERS = Object.freeze({
  PUBLIC: "public",
  AGENT_FREE: "agent_free",
  AGENT_PRO: "agent_pro",
  BROKERAGE: "brokerage",
  ADMIN: "admin",
});

/** @deprecated use `PUBLIC_USER_ACTIVE_LISTING_CAP` — re-export for existing imports */
export const PUBLIC_ACTIVE_LISTING_CAP = PUBLIC_USER_ACTIVE_LISTING_CAP;

/** @deprecated use `AGENT_ACTIVE_LISTING_CAP` — re-export for existing imports */
export const AGENT_FREE_ACTIVE_LISTING_CAP = AGENT_ACTIVE_LISTING_CAP;

/**
 * Simultaneous active listing cap for quota-capped tiers.
 * @param {string} tier from `resolveTierFromProfile`
 * @returns {number|null} cap when tier is quota-capped; null when unlimited (admin)
 */
export function resolveActiveListingCapForTier(tier) {
  return resolveTierActiveListingCap(tier);
}

export function resolveTierFromProfile(profile) {
  const role = String(profile?.role || "").toLowerCase();
  if (role === "admin") return PLATFORM_TIERS.ADMIN;
  if (role === "broker" || role === "brokerage" || role === "property_manager") {
    return PLATFORM_TIERS.BROKERAGE;
  }
  if (role === "agent_pro" || role === "verified_agent") return PLATFORM_TIERS.AGENT_PRO;
  if (role === "agent") return PLATFORM_TIERS.AGENT_FREE;
  return PLATFORM_TIERS.PUBLIC;
}

