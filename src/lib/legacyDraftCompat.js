import { getRegionByAny, normalizeRegionSlug } from "../constants/geographyLayer";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { resolveListingDistrictSlug } from "./listingPersistence";

function hasNonEmptyField(value) {
  return value != null && String(value).trim() !== "";
}

/**
 * Draft rows from before lifecycle/moderation/region enrichment columns.
 */
export function isLegacyGenerationDraft(listing = {}) {
  if (getLifecycleStatus(listing) !== LISTING_LIFECYCLE.DRAFT) return false;

  const st = String(listing.status || "").trim().toLowerCase();
  const hasLifecycleCol = hasNonEmptyField(listing.lifecycle_status);
  const hasModerationCol = hasNonEmptyField(listing.moderation_status);

  if (st === "draft" && (!hasLifecycleCol || !hasModerationCol)) return true;

  const districtSlug = resolveListingDistrictSlug(listing);
  if (districtSlug) {
    const meta = getRegionByAny(districtSlug);
    if (meta?.type === "subregion" && meta.parentDistrict) {
      if (!hasNonEmptyField(listing.region_slug) || !hasNonEmptyField(listing.subregion_slug)) {
        return true;
      }
    } else if (!hasNonEmptyField(listing.region_slug) && hasNonEmptyField(listing.district)) {
      return true;
    }
  }

  const userId = String(listing.user_id || "").trim();
  const listedBy = String(listing.listed_by || "").trim();
  if (userId && !listedBy) return true;

  return false;
}

/**
 * One-shot normalization when opening a legacy draft in the create workspace.
 * @returns {{
 *   legacy: boolean,
 *   recoverable: boolean,
 *   needsRefresh: boolean,
 *   districtSlug: string,
 *   rowPatch: Record<string, unknown>|null,
 *   mergedRow: Record<string, unknown>,
 * }}
 */
export function assessLegacyDraftForWorkspace(listing = {}) {
  const legacy = isLegacyGenerationDraft(listing);
  const districtSlug = resolveListingDistrictSlug(listing);
  const rowPatch = {};

  if (getLifecycleStatus(listing) === LISTING_LIFECYCLE.DRAFT) {
    if (!hasNonEmptyField(listing.lifecycle_status)) rowPatch.lifecycle_status = "draft";
    if (!hasNonEmptyField(listing.moderation_status)) rowPatch.moderation_status = "draft";
    if (!hasNonEmptyField(listing.status)) rowPatch.status = "draft";
  }

  if (districtSlug) {
    if (!hasNonEmptyField(listing.district)) rowPatch.district = districtSlug;
    const meta = getRegionByAny(districtSlug);
    if (meta?.type === "subregion" && meta.parentDistrict) {
      if (!hasNonEmptyField(listing.region_slug)) {
        rowPatch.region_slug = normalizeRegionSlug(meta.parentDistrict);
      }
      if (!hasNonEmptyField(listing.subregion_slug)) rowPatch.subregion_slug = districtSlug;
    } else if (!hasNonEmptyField(listing.region_slug)) {
      rowPatch.region_slug = districtSlug;
    }
  }

  const needsRefresh = legacy && !districtSlug;
  const patchKeys = Object.keys(rowPatch);

  return {
    legacy,
    recoverable: !needsRefresh,
    needsRefresh,
    districtSlug,
    rowPatch: patchKeys.length > 0 ? rowPatch : null,
    mergedRow: patchKeys.length > 0 ? { ...listing, ...rowPatch } : listing,
  };
}
