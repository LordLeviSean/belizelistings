export const LISTING_LIFECYCLE = Object.freeze({
  DRAFT: "draft",
  PENDING_REVIEW: "pending",
  VERIFIED: "verified",
  PUBLISHED: "approved",
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
  ["verify", LISTING_LIFECYCLE.VERIFIED],
  ["verified", LISTING_LIFECYCLE.VERIFIED],
  ["rent", LISTING_LIFECYCLE.RENTED],
  ["rented", LISTING_LIFECYCLE.RENTED],
  ["sale", LISTING_LIFECYCLE.SOLD],
  ["sold", LISTING_LIFECYCLE.SOLD],
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

/** Non-archived listings allowed simultaneously for AGENT_FREE tier. */
export const AGENT_FREE_ACTIVE_LISTING_CAP = 5;

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

