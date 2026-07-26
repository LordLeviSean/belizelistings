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
  buildRecentlyRentedPatch,
  buildRecentlyRentedFallback,
  buildRecentlySoldPatch,
  buildRecentlySoldFallback,
  executeListingUpdate,
} from "../lib/listingWriteContract";
import { omitSubmitForReviewWorkflowFields } from "../lib/draftListingInsertContract";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "../lib/listingMutationDiagnostics";
import {
  emitListingEventAfterMutation,
  lifecycleActionToEventDescriptor,
  resolveEventWriteParams,
} from "../lib/listingEvents";
import { coerceListingIdForDb } from "../lib/listingEvents/coerceListingId";
import {
  validateListingCompletionOwnershipAction,
  resolveListingCompletionAction,
} from "../lib/listingCompletionAction";
import { mapListingLifecycleError } from "../lib/mapListingLifecycleError";
import {
  enqueueNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
} from "../lib/notifications/notificationEvents";
import { buildListingModerationNotificationPayload } from "../lib/notifications/listingModerationNotifications";
import {
  bestEffortRemoveListingImageStorage,
  invokePermanentDeleteListingRpc,
} from "../lib/listingPermanentDelete";
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
  if (action === OWNERSHIP_ACTIONS.CLOSE_SOLD) {
    return buildRecentlySoldPatch();
  }
  if (action === OWNERSHIP_ACTIONS.CLOSE_RENTED) {
    return buildRecentlyRentedPatch();
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

function completionFallbackForAction(action) {
  if (action === OWNERSHIP_ACTIONS.CLOSE_SOLD) return buildRecentlySoldFallback();
  if (action === OWNERSHIP_ACTIONS.CLOSE_RENTED) return buildRecentlyRentedFallback();
  return null;
}

async function getCurrentActorId(supabase) {
  const { data } = await supabase.auth.getUser();
  return String(data?.user?.id || "");
}

async function emitLifecycleListingEvent(supabase, { listingId, action, fromStatus, actorId, result }) {
  const toStatus = resultAppliedStatus(result);
  const descriptor = lifecycleActionToEventDescriptor(action, { fromStatus, toStatus });
  if (!descriptor) return;

  const actorRole =
    action === OWNERSHIP_ACTIONS.APPROVE || action === OWNERSHIP_ACTIONS.REJECT
      ? "admin"
      : actorId
        ? "agent"
        : null;
  const resolved = resolveEventWriteParams(descriptor);

  await emitListingEventAfterMutation({
    client: supabase,
    listingId,
    eventType: resolved.eventType,
    payload: resolved.payload,
    visibility: resolved.visibility,
    actorId: actorId || null,
    actorRole,
    source: resolved.source,
  });
}

function resultAppliedStatus(result) {
  const patch = result?.appliedPayload || {};
  return patch.lifecycle_status || patch.status || null;
}

export async function applyListingLifecycleAction(supabase, { listingId, action, extraUpdates = {} }) {
  const base = lifecyclePayloadForAction({ action });
  const { body: merged } = omitSubmitForReviewWorkflowFields({ ...base, ...extraUpdates });
  const payload = merged;
  const minimalFallback =
    moderationFallbackForAction(action) || completionFallbackForAction(action);

  let fromStatus = null;
  let priorRow = null;
  const eventDescriptor = lifecycleActionToEventDescriptor(action);
  if (eventDescriptor) {
    const { data } = await supabase
      .from("listings")
      .select("status, lifecycle_status, listing_type, market_type, title, user_id")
      .eq("id", listingId)
      .maybeSingle();
    priorRow = data || null;
    fromStatus = getLifecycleStatus(priorRow || {});
  }

  if (
    action === OWNERSHIP_ACTIONS.CLOSE_SOLD ||
    action === OWNERSHIP_ACTIONS.CLOSE_RENTED
  ) {
    const marketCheck = validateListingCompletionOwnershipAction(priorRow || {}, action);
    if (!marketCheck.ok) {
      const message =
        marketCheck.code === "market_unknown"
          ? "Set this listing to For Sale or For Rent before marking it closed."
          : "This completion action does not match the listing market type.";
      return {
        data: null,
        error: { message, code: marketCheck.code },
        appliedPayload: payload,
        meta: { stage: "completion-market-guard", attempts: 0 },
      };
    }
  }

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

    const actorId = await getCurrentActorId(supabase);
    await emitLifecycleListingEvent(supabase, {
      listingId,
      action,
      fromStatus,
      actorId,
      result,
    });

    if (
      action === OWNERSHIP_ACTIONS.CLOSE_SOLD ||
      action === OWNERSHIP_ACTIONS.CLOSE_RENTED
    ) {
      const completion = resolveListingCompletionAction(priorRow || {});
      const recipientId = priorRow?.user_id || actorId;
      const listingTitle = priorRow?.title || "Listing";
      const eventType =
        action === OWNERSHIP_ACTIONS.CLOSE_SOLD
          ? NOTIFICATION_EVENT_TYPES.LISTING_MARKED_SOLD
          : NOTIFICATION_EVENT_TYPES.LISTING_MARKED_RENTED;
      if (recipientId) {
        await enqueueNotificationEvent(supabase, {
          eventType,
          recipientId,
          payload: {
            listing_id: listingId,
            listing_title: listingTitle,
            dedupe_key: `${eventType}:${listingId}`,
          },
        });
      }
    }

    if (action === OWNERSHIP_ACTIONS.APPROVE || action === OWNERSHIP_ACTIONS.REJECT) {
      const recipientId = priorRow?.user_id;
      if (recipientId) {
        const { eventType, payload } = buildListingModerationNotificationPayload({
          action,
          listingId,
          listingTitle: priorRow?.title || "Listing",
          moderationVersion: result.appliedPayload?.updated_at,
        });
        const notifyResult = await enqueueNotificationEvent(supabase, {
          eventType,
          recipientId,
          payload,
        });
        if (!notifyResult.ok && typeof console !== "undefined" && console.warn) {
          console.warn("[moderation] notification enqueue failed", {
            listingId,
            eventType,
            message: notifyResult.error?.message || "unknown",
          });
        }
      }
    }

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
    error: result.error
      ? { ...result.error, message: mapListingLifecycleError(result.error) }
      : null,
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

  const normalizedId = String(listingId || "").trim();
  if (!normalizedId) return { error: new Error("Listing id is required.") };

  const { data: listingRow, error: listingLoadError } = await loadListingRowForPermanentDelete(
    supabase,
    normalizedId
  );
  if (listingLoadError) return { error: listingLoadError };
  if (!listingRow) return { error: new Error("Listing no longer exists.") };
  if (!rowIsArchivedForPermanentDelete(listingRow)) {
    return { error: new Error("Permanent deletion is restricted to archived listings.") };
  }

  const dbListingId = coerceListingIdForDb(normalizedId);
  const { data: imageRows } = await supabase
    .from("listing_images")
    .select("image_url")
    .eq("listing_id", dbListingId);

  const rpcResult = await invokePermanentDeleteListingRpc(supabase, normalizedId);
  if (rpcResult.ok) {
    await bestEffortRemoveListingImageStorage(supabase, imageRows || []);
    logMutationSuccess("permanent-delete", "success-rpc-deleted", { listingId: normalizedId }, {
      via: "rpc",
    });
    return { error: null };
  }

  return { error: rpcResult.error };
}

