import { normalizeRegionSlug } from "../constants/geographyLayer";
import { normalizeLifecycleStatus } from "../constants/operationalModel";

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
  if (listing?.lifecycle_status != null && String(listing.lifecycle_status).trim() !== "") {
    return normalizeLifecycleStatus(listing.lifecycle_status);
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

