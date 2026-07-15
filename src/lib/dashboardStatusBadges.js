import { LISTING_LIFECYCLE, normalizeLifecycleStatus } from "@/constants/operationalModel";

/**
 * Maps lifecycle status to Dashboard.module.css `status*` suffix (PascalCase).
 */
export function resolveLifecycleStatusBadgeSuffix(lc, { legacyDraft = false } = {}) {
  if (legacyDraft) return "LegacyDraft";
  const normalized = normalizeLifecycleStatus(lc);
  switch (normalized) {
    case LISTING_LIFECYCLE.PUBLISHED:
      return "Approved";
    case LISTING_LIFECYCLE.PENDING_REVIEW:
      return "Pending";
    case LISTING_LIFECYCLE.RECENTLY_SOLD:
      return "RecentlySold";
    case LISTING_LIFECYCLE.RECENTLY_RENTED:
      return "RecentlyRented";
    case LISTING_LIFECYCLE.ARCHIVED:
      return "Archived";
    case LISTING_LIFECYCLE.REJECTED:
      return "Rejected";
    case LISTING_LIFECYCLE.DRAFT:
      return "Draft";
    case LISTING_LIFECYCLE.VERIFIED:
      return "Approved";
    case LISTING_LIFECYCLE.SOLD:
      return "RecentlySold";
    case LISTING_LIFECYCLE.RENTED:
      return "RecentlyRented";
    case LISTING_LIFECYCLE.EXPIRED:
      return "Archived";
    default:
      return "Draft";
  }
}
