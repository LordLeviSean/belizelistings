import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { buildModerationArchivePatch } from "@/lib/listingWriteContract";

/** Lifecycle states the create workspace may open for authorized edits. */
export const CREATE_WORKSPACE_EDITABLE_LIFECYCLES = Object.freeze([
  LISTING_LIFECYCLE.DRAFT,
  LISTING_LIFECYCLE.PENDING_REVIEW,
  LISTING_LIFECYCLE.PUBLISHED,
  LISTING_LIFECYCLE.REJECTED,
  LISTING_LIFECYCLE.ARCHIVED,
  LISTING_LIFECYCLE.RECENTLY_SOLD,
  LISTING_LIFECYCLE.RECENTLY_RENTED,
  LISTING_LIFECYCLE.SOLD,
  LISTING_LIFECYCLE.RENTED,
]);

/**
 * Whether a listing row may be opened in `/dashboard/create` for editing.
 * Authorization is checked separately via {@link canUserEditListingRow}.
 */
export function isCreateWorkspaceEditableListing(row) {
  if (!row || row.id == null) return false;
  const lc = getLifecycleStatus(row);
  return CREATE_WORKSPACE_EDITABLE_LIFECYCLES.includes(lc);
}

/**
 * Owner, assigned manager, or admin may edit when lifecycle permits.
 */
export function canUserEditListingRow({ row, userId, isAdmin = false } = {}) {
  if (!row || row.id == null || !userId) return false;
  if (!isCreateWorkspaceEditableListing(row)) return false;
  if (isAdmin) return true;

  const uid = String(userId);
  const ownerId = String(row.user_id || row.listed_by || "");
  const managerId = String(row.managed_by || row.agent_id || "");
  return ownerId === uid || managerId === uid;
}

/** Canonical edit URL — works from any dashboard; authorization is server-side + hydrate guard. */
export function resolveListingEditHref(listingId, { resubmit = false } = {}) {
  const id = encodeURIComponent(String(listingId || "").trim());
  if (!id) return "/dashboard/create";
  const base = `/dashboard/create?draft=${id}`;
  return resubmit ? `${base}&resubmit=1` : base;
}

/** Listings that should use Save changes (no submit-for-review stage). */
export function isDirectSaveEditLifecycle(lifecycle) {
  const lc = String(lifecycle || "").trim();
  return (
    lc === LISTING_LIFECYCLE.PUBLISHED ||
    lc === LISTING_LIFECYCLE.PENDING_REVIEW ||
    lc === LISTING_LIFECYCLE.RECENTLY_SOLD ||
    lc === LISTING_LIFECYCLE.RECENTLY_RENTED ||
    lc === LISTING_LIFECYCLE.SOLD ||
    lc === LISTING_LIFECYCLE.RENTED
  );
}

/** Draft/rejected/archived inventory uses the submission envelope on step 5. */
export function requiresSubmitForReviewFlow(lifecycle) {
  const lc = String(lifecycle || "").trim();
  return (
    !lc ||
    lc === LISTING_LIFECYCLE.DRAFT ||
    lc === LISTING_LIFECYCLE.REJECTED ||
    lc === LISTING_LIFECYCLE.ARCHIVED
  );
}

/**
 * PATCH lifecycle fields for create-workspace autosave.
 * Published-like rows omit lifecycle keys so status, sold_at, and verification stay intact.
 */
export function resolveEditAutosaveLifecycleFields(sourceLifecycle = "") {
  const lc = String(sourceLifecycle || "").trim();
  if (!lc || lc === LISTING_LIFECYCLE.DRAFT) {
    return {
      status: LISTING_LIFECYCLE.DRAFT,
      lifecycle_status: LISTING_LIFECYCLE.DRAFT,
      moderation_status: "draft",
    };
  }
  if (lc === LISTING_LIFECYCLE.ARCHIVED) {
    return buildModerationArchivePatch();
  }
  return {};
}

export function getCreateWorkspaceListingPatchFilters({ userId, isAdmin = false } = {}) {
  if (isAdmin || !userId) return {};
  return { user_id: String(userId) };
}
