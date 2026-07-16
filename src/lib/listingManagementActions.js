import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { resolveListingCompletionAction } from "@/lib/listingCompletionAction";

function normalizeMarketToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function viewerOwnsListing(listing, viewerUserId) {
  if (!viewerUserId) return false;
  return String(listing?.user_id ?? "") === String(viewerUserId);
}

/**
 * Independent owner/manager action eligibility for dashboard listing cards.
 * Completion market resolution must not gate Edit, Archive, or View.
 *
 * @param {object} listing
 * @param {{ viewerUserId?: string }} [viewer]
 */
export function resolveListingManagementActions(listing, { viewerUserId } = {}) {
  const lifecycle = getLifecycleStatus(listing);
  const isOwner = viewerOwnsListing(listing, viewerUserId);
  const isDraft = lifecycle === LISTING_LIFECYCLE.DRAFT;
  const isPublished = lifecycle === LISTING_LIFECYCLE.PUBLISHED;
  const isRejected = lifecycle === LISTING_LIFECYCLE.REJECTED;
  const isArchived = lifecycle === LISTING_LIFECYCLE.ARCHIVED;
  const isPending = lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW;

  const completion = isPublished ? resolveListingCompletionAction(listing) : null;

  return {
    canView: !isDraft,
    canEdit: isOwner && (isPublished || isRejected),
    canArchive: isOwner && isPublished,
    canResubmit: isOwner && isRejected,
    canDiscardDraft: isOwner && isDraft,
    canRepublish: isOwner && isArchived,
    completionAction: {
      visible: Boolean(isOwner && isPublished && completion),
      action: completion,
    },
    lifecycle,
    isDraft,
    isPublished,
    isRejected,
    isArchived,
    isPending,
    isOwner,
  };
}

/**
 * @param {object} listing
 * @returns {boolean}
 */
export function listingRowHasActionCriticalFields(listing) {
  const required = ["id", "user_id", "status"];
  return required.every((key) => listing?.[key] != null && listing?.[key] !== "");
}

export { normalizeMarketToken };
