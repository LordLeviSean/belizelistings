import { OWNERSHIP_ACTIONS } from "../constants/ownershipModel";
import { getArchiveStatus, LISTING_LIFECYCLE } from "../constants/operationalModel";
import { getLifecycleStatus } from "./canonicalListing";
import { logRawSupabaseError, logSupabaseMutationResult } from "../lib/supabaseRawError";
import { isMissingColumnError } from "../lib/supabaseCompat";
import {
  buildModerationApproveFallback,
  buildModerationApprovePatch,
  buildModerationArchiveFallback,
  buildModerationArchivePatch,
  buildModerationRejectFallback,
  buildModerationRejectPatch,
  buildModerationResubmitFallback,
  buildModerationResubmitPatch,
  executeListingUpdate,
} from "../lib/listingWriteContract";
import { omitSubmitForReviewWorkflowFields } from "../lib/draftListingInsertContract";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "../lib/listingMutationDiagnostics";
const isProd =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

function pickId(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function pickTimestamp(...values) {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export function getListingOwnershipSnapshot(listing = {}) {
  return {
    listedBy: pickId(listing?.listed_by, listing?.created_by, listing?.user_id),
    managedBy: pickId(listing?.managed_by, listing?.manager_id, listing?.assigned_to),
    verifiedBy: pickId(listing?.verified_by),
    archivedBy: pickId(listing?.archived_by),
    closedBy: pickId(listing?.closed_by, listing?.closed_by_user_id),
    moderatedBy: pickId(listing?.moderated_by, listing?.reviewed_by),
    reviewedBy: pickId(listing?.reviewed_by),
    publishedBy: pickId(listing?.published_by, listing?.approved_by),
    timestamps: {
      listedAt: pickTimestamp(listing?.created_at),
      verifiedAt: pickTimestamp(listing?.verified_at),
      archivedAt: pickTimestamp(listing?.archived_at),
      closedAt: pickTimestamp(listing?.closed_at, listing?.rented_at, listing?.sold_at),
      reviewedAt: pickTimestamp(listing?.reviewed_at),
      publishedAt: pickTimestamp(listing?.published_at, listing?.approved_at),
    },
  };
}

export function collectListingOwnershipActorIds(listing = {}) {
  const snapshot = getListingOwnershipSnapshot(listing);
  return [
    snapshot.listedBy,
    snapshot.managedBy,
    snapshot.verifiedBy,
    snapshot.archivedBy,
    snapshot.closedBy,
    snapshot.moderatedBy,
    snapshot.reviewedBy,
    snapshot.publishedBy,
  ].filter(Boolean);
}

function logMutationFailure(logTag, stage, error, payload, extra = {}) {
  if (typeof console === "undefined") return;
  logListingMutationFailureGrouped({
    operation: LISTING_MUTATION_OPERATION.PATCH,
    mutationFlow: extra.mutationFlow ?? LISTING_MUTATION_FLOW.UNSPECIFIED,
    stage: `${logTag}:${stage}`,
    attempt: extra.attempt ?? 0,
    retryMax: extra.retryMax ?? null,
    strippedKeys: extra.strippedColumnsSoFar ?? [],
    payload,
    error,
  });
}

function logMutationSuccess(logTag, stage, payload, meta = {}) {
  if (isProd || typeof console === "undefined" || !console.info) return;
  console.info(`[listing-mutation:${logTag}] stage=${stage}`, {
    finalPayload: payload,
    ...meta,
  });
}

async function updateListingSafe(supabase, listingId, updates, options = {}) {
  const {
    logTag = "update",
    mutationFlow = LISTING_MUTATION_FLOW.UNSPECIFIED,
    minimalFallback = null,
    eqFilters = {},
  } = options;

  const result = await executeListingUpdate(supabase, listingId, updates, {
    mutationFlow,
    logTag,
    eqFilters,
    minimalFallback,
  });

  if (result.error) {
    logMutationFailure(logTag, result.meta?.stage || "failed", result.error, result.appliedPayload, {
      strippedColumnsSoFar: result.meta?.strippedKeys || [],
      attempt: result.meta?.attempts ?? 0,
      retryMax: 2,
      mutationFlow,
    });
  }

  return result;
}

export async function applyListingOwnershipStamp(supabase, {
  listingId,
  updates = {},
  mutationFlow = LISTING_MUTATION_FLOW.UNSPECIFIED,
}) {
  return updateListingSafe(supabase, listingId, updates, {
    logTag: "ownership-stamp",
    mutationFlow,
  });
}

function lifecyclePayloadForAction({ action }) {
  if (action === OWNERSHIP_ACTIONS.APPROVE) {
    return buildModerationApprovePatch();
  }
  if (action === OWNERSHIP_ACTIONS.REJECT) {
    return buildModerationRejectPatch();
  }
  if (action === OWNERSHIP_ACTIONS.ARCHIVE) {
    return buildModerationArchivePatch();
  }
  if (action === OWNERSHIP_ACTIONS.REPUBLISH || action === OWNERSHIP_ACTIONS.RESUBMIT) {
    return buildModerationResubmitPatch();
  }
  if (action === OWNERSHIP_ACTIONS.VERIFY) {
    return {
      verification_status: "verified",
    };
  }
  return {};
}

function moderationFallbackForAction(action) {
  if (action === OWNERSHIP_ACTIONS.APPROVE) return buildModerationApproveFallback();
  if (action === OWNERSHIP_ACTIONS.REJECT) return buildModerationRejectFallback();
  if (action === OWNERSHIP_ACTIONS.ARCHIVE) return buildModerationArchiveFallback();
  if (action === OWNERSHIP_ACTIONS.REPUBLISH || action === OWNERSHIP_ACTIONS.RESUBMIT) {
    return buildModerationResubmitFallback();
  }
  return null;
}

async function getCurrentActorId(supabase) {
  const { data } = await supabase.auth.getUser();
  return String(data?.user?.id || "");
}

export async function applyListingLifecycleAction(supabase, { listingId, action, extraUpdates = {} }) {
  const base = lifecyclePayloadForAction({ action });
  const { body: merged } = omitSubmitForReviewWorkflowFields({ ...base, ...extraUpdates });
  const payload = merged;
  const minimalFallback = moderationFallbackForAction(action);

  const result = await updateListingSafe(supabase, listingId, payload, {
    logTag: `lifecycle:${action}`,
    minimalFallback,
  });

  if (!result.error) {
    logMutationSuccess(`lifecycle:${action}`, "success", result.appliedPayload, {
      strippedColumns: result.meta?.strippedKeys || [],
      attempts: result.meta?.attempts,
      usedFallback: result.meta?.usedFallback,
    });
    return {
      ...result,
      meta: { ...result.meta, usedMinimalFallback: Boolean(result.meta?.usedFallback) },
    };
  }

  if (action === OWNERSHIP_ACTIONS.ARCHIVE) {
    logRawSupabaseError("lifecycle:archive:final-error", result.error, {
      listingId,
      appliedPayload: result.appliedPayload,
      meta: result.meta,
    });
    const probeDirect = await supabase
      .from("listings")
      .update({ status: getArchiveStatus() })
      .eq("id", listingId);
    logSupabaseMutationResult("lifecycle:archive:direct-probe-eq-id-as-passed", probeDirect, {
      listingId,
      idArgType: typeof listingId,
      idArgValue: listingId,
    });
    if (
      probeDirect.error &&
      typeof listingId === "string" &&
      /^[0-9]+$/.test(String(listingId))
    ) {
      const probeNumeric = await supabase
        .from("listings")
        .update({ status: getArchiveStatus() })
        .eq("id", Number(listingId));
      logSupabaseMutationResult("lifecycle:archive:direct-probe-eq-id-coerced-number", probeNumeric, {
        listingId,
        idNumber: Number(listingId),
      });
    }
  }

  return {
    ...result,
    meta: { ...result.meta, usedMinimalFallback: Boolean(result.meta?.usedFallback) },
  };
}

function rowIsArchivedForPermanentDelete(row) {
  if (!row) return false;
  // Match browse/dashboard: any authoritative archived signal wins over stale lifecycle_status.
  return getLifecycleStatus(row) === LISTING_LIFECYCLE.ARCHIVED;
}

async function loadListingRowForPermanentDelete(supabase, listingId) {
  let res = await supabase
    .from("listings")
    .select("id,status,lifecycle_status,moderation_status")
    .eq("id", listingId)
    .maybeSingle();
  if (res.error && isMissingColumnError(res.error)) {
    logMutationFailure("permanent-delete", "select-fallback-legacy", res.error, {}, {
      listingId,
    });
    res = await supabase.from("listings").select("id,status").eq("id", listingId).maybeSingle();
  }
  return res;
}

export async function permanentlyDeleteArchivedListing(supabase, { listingId, statusHint = "" }) {
  void statusHint;

  const { data: listingRow, error: listingLoadError } = await loadListingRowForPermanentDelete(
    supabase,
    listingId
  );
  if (listingLoadError) return { error: listingLoadError };
  if (!listingRow) return { error: new Error("Listing no longer exists.") };
  if (!rowIsArchivedForPermanentDelete(listingRow)) {
    return { error: new Error("Permanent deletion is restricted to archived listings.") };
  }

  const actorId = await getCurrentActorId(supabase);
  const nowIso = new Date().toISOString();
  const stamp = await updateListingSafe(
    supabase,
    listingId,
    {
      deleted_by: actorId || null,
      deleted_at: nowIso,
    },
    { logTag: "permanent-delete-stamp" }
  );
  if (stamp.error) {
    console.warn("[permanent-delete] optional deleted_by/deleted_at stamp failed; proceeding with row delete", {
      message: stamp.error?.message,
      appliedPayload: stamp.appliedPayload,
    });
  }

  await supabase.from("favorites").delete().eq("listing_id", String(listingId));
  await supabase.from("listing_images").delete().eq("listing_id", listingId);
  const { error: deleteError } = await supabase.from("listings").delete().eq("id", listingId);
  if (deleteError) return { error: deleteError };
  logMutationSuccess("permanent-delete", "success-row-deleted", { listingId }, {
    stampApplied: !stamp.error,
  });
  return { error: null };
}

