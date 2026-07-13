/**
 * User dashboard listing truth contract (authoritative for metrics + cap math).
 *
 * Do NOT mix lifecycle_status + moderation_status ad hoc in dashboard UI.
 * Resolve each row with {@link getLifecycleStatus} / {@link normalizeOperationalLifecycle},
 * then bucket counts with {@link tallyOperationalLifecycleCounts}.
 *
 * | Bucket   | Meaning |
 * |----------|---------|
 * | Active   | Published / approved / live only — consumes cap slots (`approved` bucket) |
 * | Pending  | Submitted for review — moderation queue, not public (`pending` bucket) |
 * | Draft    | Incomplete workspace rows (`excluded` — not operational inventory) |
 * | Archived | Removed from public (`archived` bucket) |
 *
 * Cap / remaining / upgrade CTA use **Active** only. Pending does not reduce remaining slots.
 */
import { tallyOperationalLifecycleCounts } from "../utils/canonicalListing";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { assessLegacyDraftForWorkspace } from "./legacyDraftCompat";
import { isCreateWorkspaceEditableListing } from "./listingEditAccess";
import { formatListingLocation } from "./geography/formatListingLocation";

export { isCreateWorkspaceEditableListing };

/** @typedef {{ activeListings: number, pendingListings: number, archivedListings: number, draftListings: number, rejectedListings: number }} UserDashboardListingCounts */

/**
 * Derive dashboard metrics from owner listing rows (same shape as My Listings fetch).
 * @param {object[]} rows
 * @returns {UserDashboardListingCounts}
 */
export function deriveUserDashboardListingCounts(rows) {
  const { approved, pending, archived, rejected } = tallyOperationalLifecycleCounts(rows || []);
  let draftListings = 0;
  for (const row of rows || []) {
    if (getLifecycleStatus(row) === LISTING_LIFECYCLE.DRAFT) draftListings += 1;
  }
  return {
    activeListings: approved,
    pendingListings: pending,
    archivedListings: archived,
    draftListings,
    rejectedListings: rejected,
  };
}

/**
 * Read-time normalization for stale legacy drafts (no destructive writes).
 * @param {object} row
 * @returns {object}
 */
export function normalizeUserDashboardListingRow(row) {
  if (!row || row.id == null) return row;
  const { mergedRow } = assessLegacyDraftForWorkspace(row);
  return mergedRow;
}

/**
 * @param {object[]} rows
 * @returns {object[]}
 */
export function normalizeUserDashboardListingRows(rows) {
  return (rows || []).map(normalizeUserDashboardListingRow);
}

/** @param {object} row */
export function isUserDashboardPendingListing(row) {
  return getLifecycleStatus(row) === LISTING_LIFECYCLE.PENDING_REVIEW;
}

/** @param {object} row */
export function isUserDashboardActiveListing(row) {
  return getLifecycleStatus(row) === LISTING_LIFECYCLE.PUBLISHED;
}

/** @param {object} row */
export function isUserDashboardArchivedListing(row) {
  return getLifecycleStatus(row) === LISTING_LIFECYCLE.ARCHIVED;
}

/** My Listings grid: published, draft, rejected — not pending or archived (separate tabs). */
export function filterMyListingsPanelRows(rows) {
  return (rows || []).filter(
    (r) => !isUserDashboardPendingListing(r) && !isUserDashboardArchivedListing(r)
  );
}

/** Archived tab inventory only. */
export function filterArchivedListingsPanelRows(rows) {
  return (rows || []).filter(isUserDashboardArchivedListing);
}

/** Pending tab: moderation queue only. */
export function filterPendingListingsPanelRows(rows) {
  return (rows || []).filter(isUserDashboardPendingListing);
}

export const MY_LISTINGS_STATUS_FILTERS = Object.freeze({
  ALL: "all",
  PUBLISHED: "published",
  DRAFT: "draft",
  REJECTED: "rejected",
});

export const MY_LISTINGS_SORT_KEYS = Object.freeze({
  NEWEST: "newest",
  OLDEST: "oldest",
  PRICE_DESC: "price-desc",
  PRICE_ASC: "price-asc",
  DISTRICT: "district",
});

/**
 * @param {object[]} rows
 * @param {string} statusFilter
 */
export function filterMyListingsPanelRowsByStatus(rows, statusFilter) {
  const f = String(statusFilter || MY_LISTINGS_STATUS_FILTERS.ALL);
  if (f === MY_LISTINGS_STATUS_FILTERS.ALL) return rows || [];
  return (rows || []).filter((r) => {
    const lc = getLifecycleStatus(r);
    if (f === MY_LISTINGS_STATUS_FILTERS.PUBLISHED) return lc === LISTING_LIFECYCLE.PUBLISHED;
    if (f === MY_LISTINGS_STATUS_FILTERS.DRAFT) return lc === LISTING_LIFECYCLE.DRAFT;
    if (f === MY_LISTINGS_STATUS_FILTERS.REJECTED) return lc === LISTING_LIFECYCLE.REJECTED;
    return true;
  });
}

/**
 * @param {object[]} rows
 * @param {string} query
 */
export function filterMyListingsPanelRowsBySearch(rows, query) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter((r) => {
    const title = String(r?.title || "").toLowerCase();
    const location = String(formatListingLocation(r) || r?.district || "").toLowerCase();
    return title.includes(q) || location.includes(q);
  });
}

/**
 * @param {object[]} rows
 * @param {string} sortKey
 */
export function sortMyListingsPanelRows(rows, sortKey) {
  const key = String(sortKey || MY_LISTINGS_SORT_KEYS.NEWEST);
  const list = [...(rows || [])];
  const ts = (r) => new Date(r?.updated_at || r?.created_at || 0).getTime();
  const price = (r) => Number(r?.price) || 0;
  const location = (r) => String(formatListingLocation(r) || r?.district || "").toLowerCase();
  list.sort((a, b) => {
    if (key === MY_LISTINGS_SORT_KEYS.OLDEST) return ts(a) - ts(b);
    if (key === MY_LISTINGS_SORT_KEYS.PRICE_DESC) return price(b) - price(a);
    if (key === MY_LISTINGS_SORT_KEYS.PRICE_ASC) return price(a) - price(b);
    if (key === MY_LISTINGS_SORT_KEYS.DISTRICT) return location(a).localeCompare(location(b));
    return ts(b) - ts(a);
  });
  return list;
}
