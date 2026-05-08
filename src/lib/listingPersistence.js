import { normalizeRegionSlug, getRegionByAny } from "../constants/geographyLayer";
import { MUTATION_ENRICHMENT_STRIP_ORDER } from "./canonicalMutationStrips";
import { extractMissingColumnName, isMissingColumnError } from "./supabaseCompat";
import { logSupabaseMutationResult, snapshotSupabaseError } from "./supabaseRawError";

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
  const { data, error, status, statusText, count } = result || {};
  const strippedKeysHistory = extra.strippedColumnsSoFar ?? extra.strippedKeysHistory ?? [];

  if (isProd) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`[listing-insert] stage=${stage}`, {
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        errorHint: error?.hint ?? null,
        missingColumn:
          extra.missingColumn != null ? extra.missingColumn : extractMissingColumnName(error) || null,
        strippedKeysHistory: [...strippedKeysHistory],
        survivingKeyCount: Object.keys(body || {}).length,
      });
    }
    return { stage };
  }

  const snapshot = {
    stage,
    at: new Date().toISOString(),
    fullInsertResponse: {
      data: cloneJson(data),
      error: error ? snapshotSupabaseError(error) : null,
      status: status ?? null,
      statusText: statusText ?? null,
      count: count ?? null,
    },
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
    errorHint: error?.hint ?? null,
    survivingPayload: cloneJson(body),
    survivingPayloadKeys: Object.keys(body || {}),
    strippedKeysHistory: [...strippedKeysHistory],
    missingColumn:
      extra.missingColumn != null ? extra.missingColumn : extractMissingColumnName(error) || null,
    ...extra,
  };

  console.warn(`[listing-insert] stage=${stage}`, snapshot);
  assignBrowserInsertGlobals(error ?? null, body);
  return snapshot;
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
async function runMinimalFinalSafeInsert(supabase, originalPayload, strippedKeys, attempts, priorError) {
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

  if (typeof console !== "undefined" && console.warn) {
    console.warn("[listing-insert:minimal-final-safe] failed", {
      errorCode: result.error?.code ?? null,
      errorMessage: result.error?.message ?? null,
      errorHint: result.error?.hint ?? null,
    });
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

export function buildCreateListingPayload({
  form,
  authUserId,
  linkedPropertyId = "",
  linkedUnitId = "",
}) {
  const nowIso = new Date().toISOString();
  const selectedSlug = normalizeRegionSlug(form?.district || "");
  const meta = getRegionByAny(selectedSlug);
  let regionSlug = selectedSlug;
  let subregionSlug = null;
  if (meta?.type === "subregion" && meta.parentDistrict) {
    regionSlug = normalizeRegionSlug(meta.parentDistrict);
    subregionSlug = selectedSlug;
  }

  const listingType = String(form?.listing_type || "sale").trim().toLowerCase();
  return {
    title: String(form?.title || "").trim(),
    price: Number(form?.price || 0),
    property_type: String(form?.property_type || "").trim().toLowerCase(),
    district: selectedSlug,
    region_slug: regionSlug,
    subregion_slug: subregionSlug,
    listing_type: listingType,
    beds: Number(form?.beds || 0),
    baths: Number(form?.baths || 0),
    garage: 0,
    currency: "BZD",
    status: "pending",
    lifecycle_status: "pending",
    moderation_status: "pending_review",
    user_id: authUserId,
    listed_by: authUserId,
    managed_by: authUserId,
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
    property_id: linkedPropertyId || null,
    unit_id: linkedUnitId || null,
  };
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

export async function safeInsertListing(supabase, payload) {
  const originalPayload = { ...payload };
  let body = { ...payload };
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

    break;
  }

  const finalAttempt = await runMinimalFinalSafeInsert(
    supabase,
    originalPayload,
    strippedKeys,
    attempts,
    lastError
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

  if (isProd) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[listing-insert] terminal failure after minimal-final-safe", {
        errorMessage: terminalError?.message ?? String(terminalError),
        errorCode: terminalError?.code ?? null,
        strippedKeyCount: strippedKeys.length,
      });
    }
  } else {
    console.error("[listing-insert] terminal=after-minimal-final-safe", {
      at: new Date().toISOString(),
      attempts,
      strippedKeysHistory: strippedKeys,
      lastInsertResponse: lastResult
        ? {
            data: cloneJson(lastResult.data),
            error: lastResult.error ? snapshotSupabaseError(lastResult.error) : null,
            status: lastResult.status ?? null,
            statusText: lastResult.statusText ?? null,
            count: lastResult.count ?? null,
          }
        : null,
      errorCode: terminalError?.code ?? null,
      errorMessage: terminalError?.message ?? null,
      errorDetails: terminalError?.details ?? null,
      errorHint: terminalError?.hint ?? null,
      survivingPayload: cloneJson(body),
      survivingPayloadKeys: Object.keys(body || {}),
    });
  }

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
    .not("status", "eq", "archived")
    .or("lifecycle_status.is.null,lifecycle_status.neq.archived");

  if (error && isMissingColumnError(error)) {
    const legacy = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "archived");
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
      .neq("status", "archived");
    return Number(legacy.count || 0);
  }

  return Number(count || 0);
}
