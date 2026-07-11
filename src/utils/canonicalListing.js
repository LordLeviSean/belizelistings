import { normalizeRegionSlug } from "../constants/geographyLayer";
import { LISTING_LIFECYCLE, normalizeLifecycleStatus } from "../constants/operationalModel";
import {
  getListingClosedAt,
  isWithinRecentlyClosedWindow,
} from "../constants/listingClosedLifecycle";

/** Operational inventory buckets (draft/verified/etc. → excluded). Each listing maps to at most one. */
export const OPERATIONAL_LIFECYCLE_BUCKET = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ARCHIVED: "archived",
  EXCLUDED: "excluded",
});

/**
 * Effective lifecycle for UI/filtering. If status / moderation disagree with
 * stale lifecycle_status (common during partial migrations), archived/rejected
 * wins when any authoritative field says so.
 */
export function getLifecycleStatus(listing = {}) {
  const st = String(listing?.status || "").trim().toLowerCase();
  const lcRaw = String(listing?.lifecycle_status || "").trim().toLowerCase();
  const mod = String(listing?.moderation_status || "").trim().toLowerCase();
  if (st === "archived" || lcRaw === "archived" || mod === "archived") {
    return normalizeLifecycleStatus("archived");
  }
  if (st === "rejected" || lcRaw === "rejected" || mod === "rejected") {
    return normalizeLifecycleStatus("rejected");
  }
  const isPendingQueue =
    st === LISTING_LIFECYCLE.PENDING_REVIEW ||
    mod === "pending_review" ||
    lcRaw === "submitted" ||
    lcRaw === LISTING_LIFECYCLE.PENDING_REVIEW;
  if (isPendingQueue) return LISTING_LIFECYCLE.PENDING_REVIEW;

  if (listing?.lifecycle_status != null && String(listing.lifecycle_status).trim() !== "") {
    const fromLifecycle = normalizeLifecycleStatus(listing.lifecycle_status);
    if (fromLifecycle !== LISTING_LIFECYCLE.DRAFT) return fromLifecycle;
  }
  return normalizeLifecycleStatus(listing?.status || "draft");
}

export function getModerationStatus(listing = {}) {
  const value = String(
    listing?.moderation_status ||
      listing?.review_status ||
      (String(listing?.status || "").toLowerCase() === "pending" ? "pending_review" : "")
  )
    .trim()
    .toLowerCase();
  if (value === "pending_review" || value === "approved" || value === "rejected" || value === "archived") {
    return value;
  }
  return "unknown";
}

export function getListingRegionSlug(listing = {}) {
  return normalizeRegionSlug(
    listing?.subregion_slug || listing?.region_slug || listing?.district || ""
  );
}

/**
 * Published inventory available for new inquiries and viewing requests.
 */
export function isActiveInventoryListing(listing) {
  if (!listing || listing.id == null) return false;
  return getLifecycleStatus(listing) === LISTING_LIFECYCLE.PUBLISHED;
}

/**
 * Recently sold/rented listings within the temporary public display window.
 */
export function isRecentlyClosedPublicListing(listing, nowMs) {
  if (!listing || listing.id == null) return false;
  const lc = getLifecycleStatus(listing);
  if (lc !== LISTING_LIFECYCLE.RECENTLY_SOLD && lc !== LISTING_LIFECYCLE.RECENTLY_RENTED) {
    return false;
  }
  return isWithinRecentlyClosedWindow(getListingClosedAt(listing), nowMs);
}

/**
 * Browsable on homepage, search, agent profiles, favorites — published or recently closed.
 */
export function isBrowsableListing(listing, nowMs) {
  if (!listing || listing.id == null) return false;
  if (isActiveInventoryListing(listing)) return true;
  return isRecentlyClosedPublicListing(listing, nowMs);
}

/** @deprecated use isActiveInventoryListing for engagement gates */
export function isPubliclyVisibleListing(listing) {
  return isActiveInventoryListing(listing);
}

/** Client-side guard for browse/search/map/favorites when API rows may be stale. */
export function filterBrowsableInventory(listings, nowMs) {
  return (listings || []).filter((row) => isBrowsableListing(row, nowMs));
}

/** Active for-sale / for-rent counts only. */
export function filterActiveInventory(listings) {
  return (listings || []).filter(isActiveInventoryListing);
}

/** @deprecated use filterBrowsableInventory */
export function filterPublicInventory(listings) {
  return filterActiveInventory(listings);
}

/**
 * Whether guests/members can start new messages or viewing requests.
 */
export function isListingEngagementEnabled(listing, nowMs) {
  return isActiveInventoryListing(listing);
}

export function getListingAvailabilityMessage(listing) {
  const lc = getLifecycleStatus(listing);
  if (lc === LISTING_LIFECYCLE.RECENTLY_SOLD || lc === LISTING_LIFECYCLE.SOLD) {
    return "This property was recently sold.";
  }
  if (lc === LISTING_LIFECYCLE.RECENTLY_RENTED || lc === LISTING_LIFECYCLE.RENTED) {
    return "This property was recently rented.";
  }
  return "This listing is no longer available for inquiries.";
}

/**
 * Maps a listing to a single operational bucket for dashboard totals.
 * Uses getLifecycleStatus — each row falls into at most one operational bucket.
 */
export function normalizeOperationalLifecycle(listing) {
  if (!listing || listing.id == null) return OPERATIONAL_LIFECYCLE_BUCKET.EXCLUDED;
  const lc = getLifecycleStatus(listing);
  if (lc === LISTING_LIFECYCLE.ARCHIVED) return OPERATIONAL_LIFECYCLE_BUCKET.ARCHIVED;
  if (lc === LISTING_LIFECYCLE.REJECTED) return OPERATIONAL_LIFECYCLE_BUCKET.REJECTED;
  if (lc === LISTING_LIFECYCLE.PENDING_REVIEW) return OPERATIONAL_LIFECYCLE_BUCKET.PENDING;
  if (lc === LISTING_LIFECYCLE.PUBLISHED) return OPERATIONAL_LIFECYCLE_BUCKET.APPROVED;
  return OPERATIONAL_LIFECYCLE_BUCKET.EXCLUDED;
}

/**
 * Exact operational inventory counts aligned with getLifecycleStatus (no SQL drift).
 * totalOperational === pending + approved + rejected + archived (pairwise disjoint).
 */
export function tallyOperationalLifecycleCounts(listings) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let archived = 0;
  for (const row of listings || []) {
    const bucket = normalizeOperationalLifecycle(row);
    if (bucket === OPERATIONAL_LIFECYCLE_BUCKET.PENDING) pending += 1;
    else if (bucket === OPERATIONAL_LIFECYCLE_BUCKET.APPROVED) approved += 1;
    else if (bucket === OPERATIONAL_LIFECYCLE_BUCKET.REJECTED) rejected += 1;
    else if (bucket === OPERATIONAL_LIFECYCLE_BUCKET.ARCHIVED) archived += 1;
  }
  const totalOperational = pending + approved + rejected + archived;
  return { pending, approved, rejected, archived, totalOperational };
}

