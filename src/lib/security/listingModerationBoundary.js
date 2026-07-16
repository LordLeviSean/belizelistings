import { getLifecycleStatus } from "@/utils/canonicalListing";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { validateListingCompletionLifecyclePatch } from "@/lib/listingCompletionAction";

const ATTRIBUTION_KEYS = [
  "user_id",
  "listed_by",
  "managed_by",
  "verified_by",
  "approved_by",
  "reviewed_by",
  "published_by",
];

/**
 * Mirrors SQL `enforce_listing_owner_moderation_boundary` for regression tests.
 * @param {object} oldRow
 * @param {object} newRow
 * @param {{ isAdmin?: boolean, isServiceRole?: boolean }} [ctx]
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function validateOwnerListingPatch(oldRow, newRow, { isAdmin = false, isServiceRole = false } = {}) {
  if (isAdmin || isServiceRole) return { ok: true };

  for (const key of ATTRIBUTION_KEYS) {
    if (key in newRow && key in oldRow && newRow[key] !== oldRow[key]) {
      return { ok: false, code: key === "user_id" ? "ownership_immutable" : "attribution_immutable" };
    }
  }

  if (
    String(newRow?.verification_status || "") === "verified" &&
    String(oldRow?.verification_status || "") !== "verified"
  ) {
    return { ok: false, code: "owner_cannot_self_verify" };
  }

  const oldLc = getLifecycleStatus(oldRow);
  const newLc = getLifecycleStatus(newRow);

  if (oldLc === LISTING_LIFECYCLE.PUBLISHED && [LISTING_LIFECYCLE.RECENTLY_SOLD, LISTING_LIFECYCLE.RECENTLY_RENTED].includes(newLc)) {
    return validateListingCompletionLifecyclePatch(oldRow, newLc);
  }

  if (
    newLc === LISTING_LIFECYCLE.PENDING_REVIEW &&
    [LISTING_LIFECYCLE.DRAFT, LISTING_LIFECYCLE.REJECTED, LISTING_LIFECYCLE.ARCHIVED, LISTING_LIFECYCLE.PENDING_REVIEW].includes(
      oldLc
    )
  ) {
    return { ok: true };
  }

  if (
    [LISTING_LIFECYCLE.PUBLISHED, LISTING_LIFECYCLE.RECENTLY_SOLD, LISTING_LIFECYCLE.RECENTLY_RENTED].includes(oldLc) &&
    oldLc === newLc
  ) {
    return { ok: true };
  }

  if (
    [LISTING_LIFECYCLE.DRAFT, LISTING_LIFECYCLE.REJECTED, LISTING_LIFECYCLE.ARCHIVED].includes(oldLc) &&
    [LISTING_LIFECYCLE.DRAFT, LISTING_LIFECYCLE.REJECTED, LISTING_LIFECYCLE.ARCHIVED].includes(newLc)
  ) {
    return { ok: true };
  }

  if (String(newRow?.moderation_status || "") === "approved" && String(oldRow?.moderation_status || "") !== "approved") {
    return { ok: false, code: "owner_cannot_self_approve" };
  }

  const newApproved =
    ["approved", "published"].includes(String(newRow?.status || "").toLowerCase()) ||
    ["approved", "published"].includes(String(newRow?.lifecycle_status || "").toLowerCase());

  const oldWasApprovedFamily = [
    LISTING_LIFECYCLE.PUBLISHED,
    LISTING_LIFECYCLE.RECENTLY_SOLD,
    LISTING_LIFECYCLE.RECENTLY_RENTED,
  ].includes(oldLc);

  if (newApproved && !oldWasApprovedFamily) {
    return { ok: false, code: "owner_cannot_self_approve" };
  }

  return { ok: true };
}
