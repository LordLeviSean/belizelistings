/**
 * Canonical PostgREST `public.listings` write contract — single source for INSERT/PATCH.
 *
 * Max two network paths per mutation: primary sanitized write, then one legacy/minimal fallback.
 * Never `select(*)` — use {@link LISTING_INSERT_RETURN_TIERS} / {@link LISTING_UPDATE_RETURN_TIERS}.
 *
 * Do not add inline `.from("listings").insert|update` outside this module (except dev probes).
 */

import { MUTATION_ENRICHMENT_STRIP_ORDER } from "./canonicalMutationStrips";
import { sanitizeListingMutationPayload } from "./listingPayloadSanitize";
import { omitDraftInsertOnlyFields } from "./draftListingInsertContract";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import {
  extractMissingColumnName,
  isMissingColumnError,
  isNonRecoverableMutationError,
} from "./supabaseCompat";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
} from "./listingMutationDiagnostics";

/** Max INSERT/PATCH attempts per call (primary + one fallback). */
export const LISTING_WRITE_MAX_PATHS = 2;

const NEVER_STRIP_INSERT_KEYS = new Set([
  "user_id",
  "district",
  "listing_type",
  "property_type",
  "title",
  "price",
  "status",
]);

/** Post-insert return columns — narrowest tier last. */
export const LISTING_INSERT_RETURN_TIERS = Object.freeze([
  "id,user_id,title,price,district,status,property_type,listing_type,created_at,updated_at,lifecycle_status,moderation_status",
  "id,user_id,title,price,district,status,property_type,listing_type,created_at,updated_at",
  "id,user_id,title,price,district,status,property_type,listing_type",
  "id,user_id,title,price,district,status",
]);

/** Optional PATCH return (callers may omit `.select()`). */
export const LISTING_UPDATE_RETURN_TIERS = Object.freeze([
  "id,status,lifecycle_status,moderation_status,updated_at",
  "id,status,updated_at",
  "id,status",
]);

/**
 * Submit-for-review status fields only — schema-safe tiers (newest lifecycle value first).
 * Used as PATCH fallback when `lifecycle_status=submitted` is not yet migrated.
 */
export const SUBMIT_FOR_REVIEW_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "pending",
    lifecycle_status: "submitted",
    moderation_status: "pending_review",
  }),
  Object.freeze({
    status: "pending",
    lifecycle_status: LISTING_LIFECYCLE.PENDING_REVIEW,
    moderation_status: "pending_review",
  }),
  Object.freeze({
    status: "pending",
    moderation_status: "pending_review",
  }),
  Object.freeze({ status: "pending" }),
]);

/** Primary submit lifecycle envelope (first PATCH attempt). */
export function buildSubmitForReviewStatusPatch() {
  return { ...SUBMIT_FOR_REVIEW_STATUS_TIERS[0] };
}

/** Path-2 fallback when primary submit PATCH hits missing lifecycle/moderation columns. */
export function buildSubmitForReviewMinimalFallback() {
  return { ...SUBMIT_FOR_REVIEW_STATUS_TIERS[1] };
}

/** Admin moderation APPROVE — newest lifecycle value first (`published` → canonical `approved`). */
export const MODERATION_APPROVE_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "approved",
    lifecycle_status: "published",
    moderation_status: "approved",
  }),
  Object.freeze({
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
    moderation_status: "approved",
  }),
  Object.freeze({
    status: "approved",
    moderation_status: "approved",
  }),
  Object.freeze({ status: "approved" }),
]);

/** Admin moderation REJECT. */
export const MODERATION_REJECT_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "rejected",
    lifecycle_status: "rejected",
    moderation_status: "rejected",
  }),
  Object.freeze({
    status: "rejected",
    moderation_status: "rejected",
  }),
  Object.freeze({ status: "rejected" }),
]);

/** Admin moderation ARCHIVE — no `archived_at` (column may be absent). */
export const MODERATION_ARCHIVE_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "archived",
    lifecycle_status: "archived",
    moderation_status: "archived",
  }),
  Object.freeze({
    status: "archived",
    lifecycle_status: "archived",
  }),
  Object.freeze({ status: "archived" }),
]);

/** Restore / resubmit → pending review queue (schema-safe). */
export const MODERATION_RESUBMIT_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "pending",
    lifecycle_status: "submitted",
    moderation_status: "pending_review",
  }),
  Object.freeze({
    status: "pending",
    lifecycle_status: LISTING_LIFECYCLE.PENDING_REVIEW,
    moderation_status: "pending_review",
  }),
  Object.freeze({
    status: "pending",
    moderation_status: "pending_review",
  }),
  Object.freeze({ status: "pending" }),
]);

/**
 * Owner marks listing sold — `status` stays workflow-approved; closure lives on lifecycle_status.
 * Writing recently_sold into `status` violates listings_status_check in production.
 */
export const RECENTLY_SOLD_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    moderation_status: "approved",
  }),
  Object.freeze({
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
  }),
  Object.freeze({ lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD }),
]);

/** Owner marks listing rented — same split as sold (see RECENTLY_SOLD_STATUS_TIERS). */
export const RECENTLY_RENTED_STATUS_TIERS = Object.freeze([
  Object.freeze({
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
    moderation_status: "approved",
  }),
  Object.freeze({
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
  }),
  Object.freeze({ lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED }),
]);

export function buildModerationApprovePatch() {
  return { ...MODERATION_APPROVE_STATUS_TIERS[0], ...buildListingClosureCycleResetPatch() };
}

export function buildModerationApproveFallback() {
  return { ...MODERATION_APPROVE_STATUS_TIERS[1], ...buildListingClosureCycleResetPatch() };
}

export function buildModerationRejectPatch() {
  return { ...MODERATION_REJECT_STATUS_TIERS[0] };
}

export function buildModerationRejectFallback() {
  return { ...MODERATION_REJECT_STATUS_TIERS[1] };
}

export function buildModerationArchivePatch() {
  return { ...MODERATION_ARCHIVE_STATUS_TIERS[0] };
}

export function buildModerationArchiveFallback() {
  return { ...MODERATION_ARCHIVE_STATUS_TIERS[1] };
}

export function buildModerationResubmitPatch() {
  return { ...MODERATION_RESUBMIT_STATUS_TIERS[0], ...buildListingClosureCycleResetPatch() };
}

export function buildModerationResubmitFallback() {
  return { ...MODERATION_RESUBMIT_STATUS_TIERS[1], ...buildListingClosureCycleResetPatch() };
}

/** Clears prior sold/rented/archive timestamps when re-entering published or review workflow. */
export function buildListingClosureCycleResetPatch() {
  return {
    closed_at: null,
    sold_at: null,
    rented_at: null,
    archived_at: null,
  };
}

export function buildRecentlySoldPatch({ closedAt, closedBy } = {}) {
  const at = closedAt || new Date().toISOString();
  return {
    ...RECENTLY_SOLD_STATUS_TIERS[0],
    ...buildListingClosureCycleResetPatch(),
    sold_at: at,
    closed_at: at,
    ...(closedBy ? { closed_by: closedBy } : {}),
  };
}

export function buildRecentlySoldFallback() {
  const at = new Date().toISOString();
  return {
    ...RECENTLY_SOLD_STATUS_TIERS[1],
    ...buildListingClosureCycleResetPatch(),
    sold_at: at,
    closed_at: at,
  };
}

export function buildRecentlyRentedPatch({ closedAt, closedBy } = {}) {
  const at = closedAt || new Date().toISOString();
  return {
    ...RECENTLY_RENTED_STATUS_TIERS[0],
    ...buildListingClosureCycleResetPatch(),
    rented_at: at,
    closed_at: at,
    ...(closedBy ? { closed_by: closedBy } : {}),
  };
}

export function buildRecentlyRentedFallback() {
  const at = new Date().toISOString();
  return {
    ...RECENTLY_RENTED_STATUS_TIERS[1],
    ...buildListingClosureCycleResetPatch(),
    rented_at: at,
    closed_at: at,
  };
}

const ENRICHMENT_STRIP_SET = new Set(MUTATION_ENRICHMENT_STRIP_ORDER);

const DRAFT_INSERT_MUTATION_FLOWS = new Set([
  LISTING_MUTATION_FLOW.DRAFT_AUTOSAVE,
  LISTING_MUTATION_FLOW.CONTINUE,
]);

const isProd =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

function logPrimaryInsertFailureDiagnostics(primaryBody, error) {
  if (isProd || typeof console === "undefined" || !console.info) return;
  const minimalKeys = new Set(
    Object.keys(buildMinimalListingInsertPayload(primaryBody))
  );
  const extraKeys = Object.keys(primaryBody).filter((k) => !minimalKeys.has(k));
  console.info("[listing-insert:primary-failed]", {
    missingColumn: extractMissingColumnName(error),
    code: error?.code ?? null,
    status: error?.status ?? error?.statusCode ?? null,
    extraKeysBeyondMinimal: extraKeys,
    primaryKeys: Object.keys(primaryBody).sort(),
  });
}

/** Serialize create-workspace persists per draft id (or `__new__` before first insert). */
const persistInflight = new Map();

/**
 * @param {string} [draftListingId]
 * @returns {string}
 */
export function listingPersistLockKey(draftListingId) {
  const id = String(draftListingId || "").trim();
  return id || "__new__";
}

/**
 * Await any in-flight persist for the same draft, then run `fn` exclusively.
 * @template T
 * @param {string} lockKey
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withListingPersistLock(lockKey, fn) {
  const key = listingPersistLockKey(lockKey);
  while (persistInflight.has(key)) {
    await persistInflight.get(key);
  }
  const gate = (async () => {
    try {
      return await fn();
    } finally {
      persistInflight.delete(key);
    }
  })();
  persistInflight.set(
    key,
    gate.then(
      () => {},
      () => {}
    )
  );
  return gate;
}

/**
 * Remove enrichment keys in one pass (legacy schema compatibility).
 * @param {Record<string, unknown>} payload
 * @returns {{ body: Record<string, unknown>, strippedKeys: string[] }}
 */
export function stripListingEnrichmentPayload(payload = {}) {
  const strippedKeys = [];
  const body = { ...payload };
  for (const key of MUTATION_ENRICHMENT_STRIP_ORDER) {
    if (key in body) {
      strippedKeys.push(key);
      delete body[key];
    }
  }
  return { body, strippedKeys };
}

/**
 * Strip a single named missing column when PostgREST names it explicitly.
 * @param {Record<string, unknown>} payload
 * @param {string} columnName
 */
export function stripNamedListingColumn(payload, columnName) {
  if (!columnName || NEVER_STRIP_INSERT_KEYS.has(columnName) || !(columnName in payload)) {
    return { body: payload, strippedKeys: [] };
  }
  const { [columnName]: _removed, ...body } = payload;
  return { body, strippedKeys: [columnName] };
}

/**
 * Last-resort insert body (RLS-safe partial schema).
 * @param {Record<string, unknown>} originalPayload
 * @param {{ resolveDistrict?: (form: Record<string, unknown>) => string }} [helpers]
 */
export function buildMinimalListingInsertPayload(
  originalPayload = {},
  { resolveDistrict } = {}
) {
  const district =
    String(originalPayload?.district ?? "").trim() ||
    (typeof resolveDistrict === "function" ? resolveDistrict(originalPayload) : "") ||
    "";
  return {
    title: String(originalPayload?.title ?? "").trim() || "__bl_listing__",
    price: Number(originalPayload?.price ?? 0),
    property_type:
      String(originalPayload?.property_type ?? "house").trim().toLowerCase() || "house",
    listing_type:
      String(originalPayload?.listing_type ?? "sale").trim().toLowerCase() || "sale",
    district,
    status: String(originalPayload?.status ?? "pending").trim() || "pending",
    user_id: originalPayload?.user_id,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} body
 * @param {string[]} [returnTiers]
 */
async function insertListingWithReturnTiers(supabase, body, returnTiers = LISTING_INSERT_RETURN_TIERS) {
  let lastResult = { data: null, error: new Error("Insert not attempted") };
  for (const selectCols of returnTiers) {
    const result = await supabase.from("listings").insert(body).select(selectCols).single();
    lastResult = result;
    if (!result.error) return result;
    if (!isMissingColumnError(result.error)) break;
    const missing = extractMissingColumnName(result.error);
    if (missing && selectCols.split(",").map((c) => c.trim()).includes(missing)) {
      continue;
    }
    if (missing && missing in body) break;
    if (!missing) continue;
    break;
  }
  return lastResult;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} payload
 * @param {object} [options]
 * @param {string} [options.mutationFlow]
 * @param {(form: Record<string, unknown>) => string} [options.resolveDistrict]
 */
export async function executeListingInsert(supabase, payload, options = {}) {
  const mutationFlow = options.mutationFlow ?? "";
  const sanitized = sanitizeListingMutationPayload({ ...payload }, {
    mutationFlow,
    operation: LISTING_MUTATION_OPERATION.INSERT,
  });
  const originalPayload = { ...sanitized };
  let body = { ...sanitized };
  const strippedKeys = [];
  if (DRAFT_INSERT_MUTATION_FLOWS.has(mutationFlow)) {
    const { body: draftBody, omittedKeys } = omitDraftInsertOnlyFields(body);
    body = draftBody;
    strippedKeys.push(...omittedKeys);
  }
  let attempts = 0;

  const tryInsert = async (insertBody, stage) => {
    attempts += 1;
    const result = await insertListingWithReturnTiers(supabase, insertBody);
    return { result, stage, insertBody };
  };

  const { result, stage, insertBody } = await tryInsert(body, "primary");
  if (!result.error && result.data) {
    return {
      data: result.data,
      error: null,
      appliedPayload: insertBody,
      meta: {
        strippedKeys,
        attempts,
        usedMinimalFinalSafe: false,
        skipOwnershipEnrichment: false,
        stage,
      },
    };
  }

  const lastError = result.error;
  if (lastError) {
    logPrimaryInsertFailureDiagnostics(insertBody, lastError);
  }
  if (lastError && isNonRecoverableMutationError(lastError)) {
    return {
      data: null,
      error: lastError,
      appliedPayload: body,
      meta: {
        strippedKeys,
        attempts,
        usedMinimalFinalSafe: false,
        skipOwnershipEnrichment: false,
        stage: "primary-terminal",
      },
    };
  }

  const minimalPayload = buildMinimalListingInsertPayload(originalPayload, {
    resolveDistrict: options.resolveDistrict,
  });
  if (!minimalPayload.district) {
    return {
      data: null,
      error: new Error("Minimal insert requires district"),
      appliedPayload: minimalPayload,
      meta: { strippedKeys, attempts, usedMinimalFinalSafe: false, skipOwnershipEnrichment: true },
    };
  }
  if (!minimalPayload.user_id) {
    return {
      data: null,
      error: new Error("Minimal insert requires user_id"),
      appliedPayload: minimalPayload,
      meta: { strippedKeys, attempts, usedMinimalFinalSafe: false, skipOwnershipEnrichment: true },
    };
  }

  attempts += 1;
  const minimalResult = await insertListingWithReturnTiers(
    supabase,
    minimalPayload,
    LISTING_INSERT_RETURN_TIERS.slice(-2)
  );
  if (!minimalResult.error && minimalResult.data) {
    return {
      data: minimalResult.data,
      error: null,
      appliedPayload: minimalPayload,
      meta: {
        strippedKeys,
        attempts,
        usedMinimalFinalSafe: true,
        skipOwnershipEnrichment: true,
        stage: "minimal-final-safe",
      },
    };
  }

  return {
    data: null,
    error: minimalResult.error || lastError || new Error("Unable to insert listing safely."),
    appliedPayload: minimalPayload,
    meta: {
      strippedKeys,
      attempts,
      usedMinimalFinalSafe: false,
      skipOwnershipEnrichment: true,
      stage: "minimal-final-safe-failed",
    },
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} listingId
 * @param {Record<string, unknown>} updates
 * @param {object} [options]
 * @param {string} [options.mutationFlow]
 * @param {string} [options.logTag]
 * @param {Record<string, string>} [options.eqFilters] — extra `.eq` filters (e.g. user_id)
 * @param {boolean} [options.returnRow]
 * @param {Record<string, unknown>} [options.minimalFallback] — path-2 body when primary fails on schema
 */
export async function executeListingUpdate(supabase, listingId, updates, options = {}) {
  const {
    mutationFlow = "",
    eqFilters = {},
    returnRow = false,
    minimalFallback = null,
  } = options;

  let payload = sanitizeListingMutationPayload({ ...(updates || {}) }, {
    mutationFlow,
    operation: LISTING_MUTATION_OPERATION.PATCH,
  });
  const strippedKeys = [];
  let attempts = 0;

  const runPatch = async (patchBody, stage) => {
    attempts += 1;
    let q = supabase.from("listings").update(patchBody).eq("id", listingId);
    for (const [col, val] of Object.entries(eqFilters)) {
      q = q.eq(col, val);
    }
    if (returnRow) {
      const selectCols = LISTING_UPDATE_RETURN_TIERS[0];
      const { data, error } = await q.select(selectCols).maybeSingle();
      return { error, data, stage, appliedPayload: patchBody };
    }
    const { error } = await q;
    return { error, data: null, stage, appliedPayload: patchBody };
  };

  let { error, data, stage, appliedPayload } = await runPatch(payload, "primary");
  if (!error) {
    return { data, error: null, appliedPayload, meta: { strippedKeys, attempts, stage } };
  }

  if (isNonRecoverableMutationError(error)) {
    return { data: null, error, appliedPayload, meta: { strippedKeys, attempts, stage: "primary-terminal" } };
  }

  if (attempts < LISTING_WRITE_MAX_PATHS) {
    let fallbackBody = null;
    if (minimalFallback && typeof minimalFallback === "object") {
      fallbackBody = sanitizeListingMutationPayload({ ...minimalFallback }, {
        mutationFlow,
        operation: LISTING_MUTATION_OPERATION.PATCH,
      });
    } else if (isMissingColumnError(error)) {
      const missing = extractMissingColumnName(error);
      if (missing && missing !== "user_id" && missing in payload) {
        strippedKeys.push(missing);
        const { body } = stripNamedListingColumn(payload, missing);
        fallbackBody = body;
      } else {
        const { body, strippedKeys: bulk } = stripListingEnrichmentPayload(payload);
        strippedKeys.push(...bulk);
        fallbackBody = body;
      }
    }
    if (fallbackBody && Object.keys(fallbackBody).length > 0) {
      ({ error, data, stage, appliedPayload } = await runPatch(fallbackBody, "fallback"));
      if (!error) {
        return {
          data,
          error: null,
          appliedPayload,
          meta: { strippedKeys, attempts, stage, usedFallback: true },
        };
      }
    }
  }

  return {
    data: null,
    error: error || new Error("Unable to apply listing update safely."),
    appliedPayload,
    meta: { strippedKeys, attempts, stage: "failed" },
  };
}

/** @deprecated Use stripListingEnrichmentPayload — tests/imports alias */
export function stripEnrichmentKeysForLegacySchema(payload) {
  return stripListingEnrichmentPayload(payload);
}

export { ENRICHMENT_STRIP_SET, NEVER_STRIP_INSERT_KEYS };
