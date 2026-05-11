import { normalizeRegionSlug, getRegionByAny } from "../constants/geographyLayer";
import { sanitizeAmenitiesArray } from "../constants/listingAmenities";
import { isLandInventoryListing } from "../utils/listingPresentation";
import { applyListingOwnershipStamp } from "../utils/ownershipAttribution";
import { MUTATION_ENRICHMENT_STRIP_ORDER } from "./canonicalMutationStrips";
import { extractMissingColumnName, isMissingColumnError } from "./supabaseCompat";
import { logSupabaseMutationResult, snapshotSupabaseError } from "./supabaseRawError";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "./listingMutationDiagnostics";
import { sanitizeListingMutationPayload } from "./listingPayloadSanitize";

const NEVER_STRIP_INSERT_KEYS = new Set(["user_id"]);

const isProd =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return value ?? null;
  }
}

/** Dev-only: last failed insert snapshot on window for debugging. */
function assignBrowserInsertGlobals(error, payload) {
  if (isProd || typeof window === "undefined") return;
  window.__BL_LAST_INSERT_ERROR = error != null ? snapshotSupabaseError(error) : null;
  window.__BL_LAST_INSERT_PAYLOAD = cloneJson(payload);
}

function logInsertAttemptFull(stage, result, body, extra = {}) {
  const { error } = result || {};
  const strippedKeysHistory = extra.strippedColumnsSoFar ?? extra.strippedKeysHistory ?? [];

  if (error) {
    logListingMutationFailureGrouped({
      operation: LISTING_MUTATION_OPERATION.INSERT,
      mutationFlow: extra.mutationFlow ?? LISTING_MUTATION_FLOW.UNSPECIFIED,
      stage,
      attempt: extra.attempt ?? 0,
      retryMax: extra.retryMax ?? null,
      strippedKeys: strippedKeysHistory,
      payload: body,
      error,
    });
    assignBrowserInsertGlobals(error, body);
  }

  return { stage };
}

function logInsertSuccess(stage, body, meta = {}) {
  if (isProd || typeof console === "undefined" || !console.info) return;
  console.info(`[listing-insert] stage=${stage}`, {
    at: new Date().toISOString(),
    finalPayloadKeys: Object.keys(body || {}),
    finalPayload: cloneJson(body),
    strippedKeysHistory: meta.strippedKeysHistory ?? [],
    ...meta,
  });
}

/**
 * Last-resort insert: ONLY title, price, status pending, user_id (RLS-safe partial schema).
 */
async function runMinimalFinalSafeInsert(
  supabase,
  originalPayload,
  strippedKeys,
  attempts,
  priorError,
  { mutationFlow = LISTING_MUTATION_FLOW.UNSPECIFIED } = {}
) {
  const minimalPayload = {
    title: String(originalPayload?.title ?? "").trim() || "__bl_listing__",
    price: Number(originalPayload?.price ?? 0),
    status: "pending",
    user_id: originalPayload?.user_id,
  };

  if (!isProd) {
    console.info("[listing-insert:minimal-final-safe]", {
      at: new Date().toISOString(),
      survivingPayload: cloneJson(minimalPayload),
      strippedKeysHistory: [...strippedKeys],
      attempts,
      priorError: priorError ? snapshotSupabaseError(priorError) : null,
    });
  }

  if (!minimalPayload.user_id) {
    const err = new Error("Minimal insert requires user_id");
    console.error("[listing-insert:minimal-final-safe] aborted: missing user_id");
    return { data: null, error: err, appliedPayload: minimalPayload };
  }

  const result = await supabase.from("listings").insert(minimalPayload).select().single();

  if (!result.error && result.data) {
    if (!isProd) {
      console.info("[listing-insert:minimal-final-safe] success", {
        id: result.data?.id ?? null,
        survivingPayload: cloneJson(minimalPayload),
      });
    }
    assignBrowserInsertGlobals(null, minimalPayload);
    return { data: result.data, error: null, appliedPayload: minimalPayload };
  }

  if (result.error) {
    logListingMutationFailureGrouped({
      operation: LISTING_MUTATION_OPERATION.INSERT,
      mutationFlow,
      stage: "minimal-final-safe",
      attempt: attempts,
      retryMax: null,
      strippedKeys,
      payload: minimalPayload,
      error: result.error,
    });
    assignBrowserInsertGlobals(result.error, minimalPayload);
  }
  return { data: null, error: result.error, appliedPayload: minimalPayload };
}

/**
 * Dev-only diagnostic: insert without user_id, then roll back if it succeeds.
 */
async function runMinimalListingInsertProbe(supabase, originalPayload) {
  if (isProd) {
    return { skipped: true };
  }

  const minimal = {
    title: String(originalPayload?.title ?? "").trim() || "__bl_minimal_probe__",
    price: Number(originalPayload?.price ?? 0),
    status: "pending",
  };

  const result = await supabase.from("listings").insert(minimal).select().single();

  const summary = {
    at: new Date().toISOString(),
    attemptedPayload: cloneJson(minimal),
    data: cloneJson(result.data),
    error: result.error ? snapshotSupabaseError(result.error) : null,
    errorCode: result.error?.code ?? null,
    errorMessage: result.error?.message ?? null,
    errorDetails: result.error?.details ?? null,
    errorHint: result.error?.hint ?? null,
    status: result.status ?? null,
    statusText: result.statusText ?? null,
    count: result.count ?? null,
  };

  console.error("[listing-insert:minimal-probe]", summary);
  logSupabaseMutationResult("listing-insert:minimal-probe", result, { minimal });

  if (!result.error && result.data?.id) {
    const del = await supabase.from("listings").delete().eq("id", result.data.id).select("id");
    console.info("[listing-insert:minimal-probe] rollback probe row", {
      id: result.data.id,
      deleteError: del.error ? snapshotSupabaseError(del.error) : null,
      deleteData: cloneJson(del.data),
    });
  }

  return summary;
}

function buildListingCoreFields({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const selectedSlug = normalizeRegionSlug(form?.district || "");
  const meta = getRegionByAny(selectedSlug);
  let regionSlug = selectedSlug;
  let subregionSlug = null;
  if (meta?.type === "subregion" && meta.parentDistrict) {
    regionSlug = normalizeRegionSlug(meta.parentDistrict);
    subregionSlug = selectedSlug;
  }

  const listingType = String(form?.listing_type || "sale").trim().toLowerCase();
  const land = isLandInventoryListing({
    property_type: form?.property_type,
    listing_type: form?.listing_type,
    market_type: form?.market_type,
    category: form?.category,
  });

  const desc = String(form?.description ?? "").trim();
  const amenities = sanitizeAmenitiesArray(form?.amenities);
  const legacy = String(form?.legacyFeaturesTail ?? "").trim();
  const sqRaw = form?.square_feet;
  const sqParsed = sqRaw !== "" && sqRaw != null ? Number(sqRaw) : NaN;

  let beds;
  let baths;
  let garage;
  if (land) {
    beds = null;
    baths = null;
    garage = null;
  } else {
    const bedsRaw = form?.beds;
    const bathsRaw = form?.baths;
    beds = bedsRaw === "" || bedsRaw == null ? 0 : Number(bedsRaw || 0);
    baths = bathsRaw === "" || bathsRaw == null ? 0 : Number(bathsRaw || 0);
    garage = 0;
  }

  const payload = {
    title: String(form?.title || "").trim(),
    price: Number(form?.price || 0),
    property_type: String(form?.property_type || "").trim().toLowerCase(),
    district: selectedSlug,
    region_slug: regionSlug,
    subregion_slug: subregionSlug,
    listing_type: listingType,
    beds,
    baths,
    garage,
    currency: "BZD",
    user_id: authUserId,
    listed_by: authUserId,
    managed_by: authUserId,
    unit_id: linkedUnitId || null,
    description: desc.length > 0 ? desc : null,
  };
  payload.amenities = amenities.length > 0 ? amenities : null;
  if (legacy) {
    payload.features = amenities.length ? `${legacy}, ${amenities.join(", ")}` : legacy;
  } else if (amenities.length > 0) {
    payload.features = amenities.join(", ");
  } else {
    payload.features = null;
  }
  if (!Number.isNaN(sqParsed)) payload.square_feet = sqParsed;
  return payload;
}

/** Full insert payload for submit-for-review / non-draft creation paths. */
export function buildCreateListingPayload({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const nowIso = new Date().toISOString();
  const core = buildListingCoreFields({ form, authUserId, linkedUnitId });
  return {
    ...core,
    status: "pending",
    lifecycle_status: "pending",
    moderation_status: "pending_review",
    reviewed_by: null,
    moderated_by: null,
    published_by: null,
    verified_by: null,
    archived_by: null,
    closed_by: null,
    deleted_by: null,
    published_at: null,
    verified_at: null,
    archived_at: null,
    rented_at: null,
    sold_at: null,
    expired_at: null,
    deleted_at: null,
    reviewed_at: null,
    created_at: nowIso,
    updated_at: nowIso,
    occupancy_status: null,
    vacancy_status: null,
    occupied_at: null,
    vacated_at: null,
    maintenance_hold: false,
    seasonal_hold: false,
  };
}

/** Insert payload for a private draft row (not moderated, not public inventory). */
export function buildDraftListingPayload({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const nowIso = new Date().toISOString();
  const core = buildListingCoreFields({ form, authUserId, linkedUnitId });
  const title = core.title || "Untitled draft";
  const price = Number.isFinite(core.price) && core.price > 0 ? core.price : 0;

  return {
    ...core,
    title,
    price,
    status: "draft",
    lifecycle_status: "draft",
    moderation_status: "draft",
    reviewed_by: null,
    moderated_by: null,
    published_by: null,
    verified_by: null,
    archived_by: null,
    closed_by: null,
    deleted_by: null,
    published_at: null,
    verified_at: null,
    archived_at: null,
    rented_at: null,
    sold_at: null,
    expired_at: null,
    deleted_at: null,
    reviewed_at: null,
    created_at: nowIso,
    updated_at: nowIso,
    occupancy_status: null,
    vacancy_status: null,
    occupied_at: null,
    vacated_at: null,
    maintenance_hold: false,
    seasonal_hold: false,
  };
}

/** Partial update while staying in draft (controlled saves). Omits ownership ids — unchanged server-side. */
export function buildDraftAutosavePayload({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const nowIso = new Date().toISOString();
  const core = buildListingCoreFields({
    form,
    authUserId,
    linkedUnitId,
  });
  const { user_id: _uid, listed_by: _lb, managed_by: _mb, ...writable } = core;

  const title = writable.title || "Untitled draft";
  const price = Number.isFinite(writable.price) ? writable.price : 0;

  return {
    ...writable,
    title,
    price,
    status: "draft",
    lifecycle_status: "draft",
    moderation_status: "draft",
    updated_at: nowIso,
  };
}

/** Transition a draft listing to pending review with full field snapshot + canonical lifecycle. */
export async function submitDraftListingForReview(supabase, {
  listingId,
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const snapshot = buildCreateListingPayload({
    form,
    authUserId,
    linkedUnitId,
  });
  const { created_at: _c, user_id: _u, ...rest } = snapshot;
  const updates = {
    ...rest,
    status: "pending",
    lifecycle_status: "pending",
    moderation_status: "pending_review",
    updated_at: new Date().toISOString(),
  };
  return applyListingOwnershipStamp(supabase, {
    listingId,
    updates,
    mutationFlow: LISTING_MUTATION_FLOW.SUBMIT_DRAFT_REVIEW,
  });
}

function buildInsertSuccessMeta({ strippedKeys, attempts, usedMinimalFinalSafe }) {
  const skipOwnershipEnrichment = usedMinimalFinalSafe || strippedKeys.length > 0;
  return {
    strippedKeys,
    attempts,
    usedMinimalFinalSafe,
    skipOwnershipEnrichment,
  };
}

export async function safeInsertListing(supabase, payload, options = {}) {
  const mutationFlow = options.mutationFlow ?? LISTING_MUTATION_FLOW.UNSPECIFIED;
  const sanitized = sanitizeListingMutationPayload({ ...payload }, {
    mutationFlow,
    operation: LISTING_MUTATION_OPERATION.INSERT,
  });
  const originalPayload = { ...sanitized };
  let body = { ...sanitized };
  let attempts = 0;
  const maxAttempts = 48;
  const strippedKeys = [];
  let lastError = null;
  let lastResult = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    const result = await supabase.from("listings").insert(body).select().single();
    lastResult = result;
    const { data, error } = result;

    if (!error) {
      assignBrowserInsertGlobals(null, body);
      logInsertSuccess("success", body, {
        attempts,
        strippedKeysHistory: strippedKeys,
        skipOwnershipEnrichment: strippedKeys.length > 0,
        usedMinimalFinalSafe: false,
      });
      return {
        data,
        error: null,
        appliedPayload: body,
        meta: buildInsertSuccessMeta({ strippedKeys, attempts, usedMinimalFinalSafe: false }),
      };
    }

    lastError = error;
    logInsertAttemptFull(`strip-or-fatal:${attempts}`, result, body, {
      strippedColumnsSoFar: strippedKeys,
      mutationFlow,
      attempt: attempts,
      retryMax: maxAttempts,
    });

    const missingFromMessage = extractMissingColumnName(error);
    if (
      missingFromMessage &&
      !NEVER_STRIP_INSERT_KEYS.has(missingFromMessage) &&
      missingFromMessage in body
    ) {
      strippedKeys.push(missingFromMessage);
      const { [missingFromMessage]: _removed, ...next } = body;
      body = next;
      continue;
    }

    if (isMissingColumnError(error)) {
      const stripKey = MUTATION_ENRICHMENT_STRIP_ORDER.find(
        (k) => !NEVER_STRIP_INSERT_KEYS.has(k) && k in body
      );
      if (stripKey) {
        strippedKeys.push(stripKey);
        const { [stripKey]: _r, ...next } = body;
        body = next;
        continue;
      }
    }

    logListingMutationFailureGrouped({
      operation: LISTING_MUTATION_OPERATION.INSERT,
      mutationFlow,
      stage: "strip-loop-exhausted",
      attempt: attempts,
      retryMax: maxAttempts,
      strippedKeys,
      payload: body,
      error: lastError,
    });
    assignBrowserInsertGlobals(lastError, body);
    break;
  }

  const finalAttempt = await runMinimalFinalSafeInsert(
    supabase,
    originalPayload,
    strippedKeys,
    attempts,
    lastError,
    { mutationFlow }
  );

  if (!finalAttempt.error && finalAttempt.data) {
    logInsertSuccess("minimal-final-safe-success", finalAttempt.appliedPayload, {
      attempts,
      strippedKeysHistory: strippedKeys,
      skipOwnershipEnrichment: true,
      usedMinimalFinalSafe: true,
    });
    return {
      data: finalAttempt.data,
      error: null,
      appliedPayload: finalAttempt.appliedPayload,
      meta: buildInsertSuccessMeta({ strippedKeys, attempts, usedMinimalFinalSafe: true }),
    };
  }

  await runMinimalListingInsertProbe(supabase, originalPayload);

  const terminalError = finalAttempt.error || lastError || new Error("Unable to insert listing safely.");
  assignBrowserInsertGlobals(terminalError, body);

  logListingMutationFailureGrouped({
    operation: LISTING_MUTATION_OPERATION.INSERT,
    mutationFlow,
    stage: "terminal-after-minimal-final-safe",
    attempt: attempts,
    retryMax: maxAttempts,
    strippedKeys,
    payload: body,
    error: terminalError,
  });

  return {
    data: null,
    error: terminalError,
    appliedPayload: body,
    meta: {
      strippedKeys,
      attempts,
      usedMinimalFinalSafe: false,
      skipOwnershipEnrichment: false,
    },
  };
}

/**
 * Listings that count toward free-agent active cap: not archived on status and
 * not archived on lifecycle_status when that column is used.
 */
export async function getUserActiveListingCount(supabase, userId) {
  let { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "draft")
    .not("status", "eq", "archived")
    .or("lifecycle_status.is.null,lifecycle_status.neq.archived");

  if (error && isMissingColumnError(error)) {
    const legacy = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived")
      .neq("status", "draft");
    return Number(legacy.count || 0);
  }

  if (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[listing-active-count] canonical query failed; using legacy count", {
        userId,
        message: error?.message,
        details: error?.details,
      });
    }
    const legacy = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived")
      .neq("status", "draft");
    return Number(legacy.count || 0);
  }

  return Number(count || 0);
}
