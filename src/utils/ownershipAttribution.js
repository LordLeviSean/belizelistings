import { OWNERSHIP_ACTIONS, OWNERSHIP_KEYS } from "../constants/ownershipModel";
import { getArchiveStatus, getModerationStatus, getRepublishStatus } from "../constants/operationalModel";
import { MUTATION_ENRICHMENT_STRIP_ORDER } from "../lib/canonicalMutationStrips";
import { logRawSupabaseError, logSupabaseMutationResult } from "../lib/supabaseRawError";
import {
  extractMissingColumnName,
  isMissingColumnError,
} from "../lib/supabaseCompat";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "../lib/listingMutationDiagnostics";
import { sanitizeListingMutationPayload } from "../lib/listingPayloadSanitize";

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
    maxAttempts = 28,
    mutationFlow = LISTING_MUTATION_FLOW.UNSPECIFIED,
  } = options;
  let payload = sanitizeListingMutationPayload({ ...(updates || {}) }, {
    mutationFlow,
    operation: LISTING_MUTATION_OPERATION.PATCH,
  });
  let attempts = 0;
  let lastError = null;
  const strippedKeys = [];

  while (attempts < maxAttempts) {
    attempts += 1;
    const { error } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", listingId);
    if (!error) {
      return {
        data: null,
        error: null,
        appliedPayload: payload,
        meta: { strippedKeys, attempts },
      };
    }
    lastError = error;

    const missingFromMessage = extractMissingColumnName(error);
    if (
      missingFromMessage &&
      missingFromMessage !== "user_id" &&
      missingFromMessage in payload
    ) {
      strippedKeys.push(missingFromMessage);
      logMutationFailure(logTag, `strip-named:${attempts}`, error, payload, {
        strippedKey: missingFromMessage,
        strippedColumnsSoFar: [...strippedKeys],
        attempt: attempts,
        retryMax: maxAttempts,
        mutationFlow,
      });
      const { [missingFromMessage]: _removed, ...next } = payload;
      payload = next;
      continue;
    }

    if (isMissingColumnError(error)) {
      const stripKey = MUTATION_ENRICHMENT_STRIP_ORDER.find(
        (k) => k !== "user_id" && k in payload
      );
      if (stripKey) {
        strippedKeys.push(stripKey);
        logMutationFailure(logTag, `strip-enrichment:${attempts}`, error, payload, {
          strippedKey: stripKey,
          parsedColumn: missingFromMessage || null,
          strippedColumnsSoFar: [...strippedKeys],
          attempt: attempts,
          retryMax: maxAttempts,
          mutationFlow,
        });
        const { [stripKey]: _r, ...next } = payload;
        payload = next;
        continue;
      }
    }

    logMutationFailure(logTag, `non-recoverable:${attempts}`, error, payload, {
      parsedColumn: missingFromMessage || null,
      missingColumnError: isMissingColumnError(error),
      strippedColumnsSoFar: strippedKeys,
      attempt: attempts,
      retryMax: maxAttempts,
      mutationFlow,
    });
    return {
      data: null,
      error,
      appliedPayload: payload,
      meta: { strippedKeys, attempts },
    };
  }

  return {
    data: null,
    error: lastError || new Error("Unable to apply listing update safely."),
    appliedPayload: payload,
    meta: { strippedKeys, attempts },
  };
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

/** Restore from archived, or resubmit from rejected → pending review (not public). */
function pendingReviewQueuePayload(actor) {
  const pending = getRepublishStatus();
  return {
    status: pending,
    lifecycle_status: pending,
    moderation_status: "pending_review",
    archived_at: null,
    published_at: null,
    reviewed_at: null,
    [OWNERSHIP_KEYS.ARCHIVED_BY]: null,
    [OWNERSHIP_KEYS.PUBLISHED_BY]: null,
    [OWNERSHIP_KEYS.REVIEWED_BY]: null,
    [OWNERSHIP_KEYS.MODERATED_BY]: actor,
  };
}

function lifecyclePayloadForAction({ action, actorId, nowIso }) {
  const actor = actorId || null;
  if (action === OWNERSHIP_ACTIONS.APPROVE) {
    const approved = getModerationStatus("approved");
    return {
      status: approved,
      lifecycle_status: approved,
      moderation_status: "approved",
      reviewed_at: nowIso,
      published_at: nowIso,
      [OWNERSHIP_KEYS.REVIEWED_BY]: actor,
      [OWNERSHIP_KEYS.MODERATED_BY]: actor,
      [OWNERSHIP_KEYS.PUBLISHED_BY]: actor,
    };
  }
  if (action === OWNERSHIP_ACTIONS.REJECT) {
    const rejected = getModerationStatus("rejected");
    return {
      status: rejected,
      lifecycle_status: rejected,
      moderation_status: "rejected",
      published_at: null,
      reviewed_at: null,
      last_reviewed_at: nowIso,
      [OWNERSHIP_KEYS.PUBLISHED_BY]: null,
      [OWNERSHIP_KEYS.REVIEWED_BY]: null,
      [OWNERSHIP_KEYS.MODERATED_BY]: actor,
    };
  }
  if (action === OWNERSHIP_ACTIONS.ARCHIVE) {
    const archived = getArchiveStatus();
    return {
      status: archived,
      lifecycle_status: archived,
      moderation_status: "archived",
      archived_at: nowIso,
      [OWNERSHIP_KEYS.ARCHIVED_BY]: actor,
      [OWNERSHIP_KEYS.MODERATED_BY]: actor,
    };
  }
  if (action === OWNERSHIP_ACTIONS.REPUBLISH || action === OWNERSHIP_ACTIONS.RESUBMIT) {
    return pendingReviewQueuePayload(actor);
  }
  if (action === OWNERSHIP_ACTIONS.VERIFY) {
    return {
      verified_at: nowIso,
      verification_status: "verified",
      [OWNERSHIP_KEYS.VERIFIED_BY]: actor,
    };
  }
  return {};
}

async function getCurrentActorId(supabase) {
  const { data } = await supabase.auth.getUser();
  return String(data?.user?.id || "");
}

export async function applyListingLifecycleAction(supabase, { listingId, action, extraUpdates = {} }) {
  const actorId = await getCurrentActorId(supabase);
  const nowIso = new Date().toISOString();
  const base = lifecyclePayloadForAction({ action, actorId, nowIso });
  const payload = { ...base, ...extraUpdates };
  const primary = await updateListingSafe(supabase, listingId, payload, {
    logTag: `lifecycle:${action}`,
  });
  if (!primary.error) {
    logMutationSuccess(`lifecycle:${action}`, "success-primary", primary.appliedPayload, {
      strippedColumns: primary.meta?.strippedKeys || [],
      attempts: primary.meta?.attempts,
    });
    return { ...primary, meta: { ...primary.meta, usedMinimalFallback: false } };
  }

  if (action === OWNERSHIP_ACTIONS.ARCHIVE) {
    const archived = getArchiveStatus();
    const minimal = { status: archived, lifecycle_status: archived, moderation_status: "archived" };
    logMutationFailure(`lifecycle:${action}`, "fallback-minimal-archive", primary.error, minimal, {
      priorStage: "primary-failed",
      primaryStripped: primary.meta?.strippedKeys || [],
    });
    const minimalResult = await updateListingSafe(supabase, listingId, minimal, {
      logTag: `lifecycle:${action}:minimal-archive`,
    });
    if (!minimalResult.error) {
      logMutationSuccess(`lifecycle:${action}`, "success-fallback-minimal-archive", minimalResult.appliedPayload, {
        strippedColumnsPrimary: primary.meta?.strippedKeys || [],
        strippedColumnsFallback: minimalResult.meta?.strippedKeys || [],
      });
    } else {
      logRawSupabaseError("lifecycle:archive:minimal-path-final-error", minimalResult.error, {
        listingId,
        appliedPayload: minimalResult.appliedPayload,
        meta: minimalResult.meta,
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
      ...minimalResult,
      meta: {
        ...minimalResult.meta,
        usedMinimalFallback: !minimalResult.error,
        primaryStrippedKeys: primary.meta?.strippedKeys,
      },
    };
  }
  if (action === OWNERSHIP_ACTIONS.REPUBLISH || action === OWNERSHIP_ACTIONS.RESUBMIT) {
    const minimal = {
      status: getRepublishStatus(),
      lifecycle_status: getRepublishStatus(),
      moderation_status: "pending_review",
    };
    logMutationFailure(`lifecycle:${action}`, "fallback-minimal-pending-queue", primary.error, minimal, {
      priorStage: "primary-failed",
      primaryStripped: primary.meta?.strippedKeys || [],
    });
    const minimalResult = await updateListingSafe(supabase, listingId, minimal, {
      logTag: `lifecycle:${action}:minimal-pending-queue`,
    });
    if (!minimalResult.error) {
      logMutationSuccess(
        `lifecycle:${action}`,
        "success-fallback-minimal-pending-queue",
        minimalResult.appliedPayload,
        {
          strippedColumnsPrimary: primary.meta?.strippedKeys || [],
          strippedColumnsFallback: minimalResult.meta?.strippedKeys || [],
        }
      );
    }
    return {
      ...minimalResult,
      meta: {
        ...minimalResult.meta,
        usedMinimalFallback: !minimalResult.error,
        primaryStrippedKeys: primary.meta?.strippedKeys,
      },
    };
  }

  return primary;
}

function rowIsArchivedForPermanentDelete(row) {
  if (!row) return false;
  const lc = String(row.lifecycle_status ?? "").trim().toLowerCase();
  const st = String(row.status ?? "").trim().toLowerCase();
  if (lc) return lc === "archived";
  return st === "archived";
}

async function loadListingRowForPermanentDelete(supabase, listingId) {
  let res = await supabase
    .from("listings")
    .select("id,status,lifecycle_status")
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

