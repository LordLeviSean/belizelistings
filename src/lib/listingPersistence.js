import { normalizeRegionSlug, getRegionByAny } from "../constants/geographyLayer";
import { sanitizeAmenitiesArray } from "../constants/listingAmenities";
import { isLandInventoryListing } from "../utils/listingPresentation";
import { isTerminalDashboardCountError } from "./supabaseCompat";
import { logDashboardMetricFailureOnce } from "./dashboardMetricsTelemetry";
import { logSupabaseMutationResult, snapshotSupabaseError } from "./supabaseRawError";
import {
  LISTING_MUTATION_FLOW,
  LISTING_MUTATION_OPERATION,
  logListingMutationFailureGrouped,
} from "./listingMutationDiagnostics";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { getLifecycleStatus, tallyOperationalLifecycleCounts } from "../utils/canonicalListing";
import {
  LISTING_DASHBOARD_COUNT_SELECT_TIERS,
  buildListingDashboardCountSelect,
  executeListingDashboardSelectQuery,
} from "./listingDashboardSelectContract";
import {
  omitDraftInsertOnlyFields,
  omitSubmitForReviewWorkflowFields,
} from "./draftListingInsertContract";
import {
  LISTING_INSERT_RETURN_TIERS,
  buildModerationArchivePatch,
  buildSubmitForReviewStatusPatch,
  executeListingInsert,
  executeListingUpdate,
} from "./listingWriteContract";
import {
  buildCreatedPayload,
  emitListingEventAfterMutation,
  LISTING_EVENT_TYPES,
} from "./listingEvents";

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

  const probeSelect = LISTING_INSERT_RETURN_TIERS[LISTING_INSERT_RETURN_TIERS.length - 1];
  const result = await supabase.from("listings").insert(minimal).select(probeSelect).single();

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

/**
 * Resolve canonical district slug from form region fields (label, slug, or parent region).
 * @param {Record<string, unknown>} form
 * @returns {string}
 */
export function resolveListingDistrictSlug(form = {}) {
  const candidates = [form?.district, form?.subregion_slug, form?.region_slug].filter(Boolean);
  for (const raw of candidates) {
    const slug = normalizeRegionSlug(raw);
    if (slug && getRegionByAny(slug)) return slug;
  }
  return "";
}

/**
 * Pre-mutation contract for draft insert/update (avoids NOT NULL / RLS churn).
 * @param {{ form?: Record<string, unknown>, authUserId?: string|null }} args
 */
export function validateListingDraftContract({ form = {}, authUserId = null } = {}) {
  const errors = {};
  if (!authUserId) errors.auth = "Sign in to save your draft.";
  const district = resolveListingDistrictSlug(form);
  if (!district) errors.district = "Select a region.";
  const property_type = String(form?.property_type ?? "").trim().toLowerCase();
  if (!property_type) errors.property_type = "Select a property type.";
  const listing_type = String(form?.listing_type ?? "sale").trim().toLowerCase();
  if (listing_type !== "sale" && listing_type !== "rent") {
    errors.listing_type = "Choose sale or rent.";
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    district,
    property_type,
    listing_type,
  };
}

function buildListingCoreFields({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const selectedSlug = resolveListingDistrictSlug(form);
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

export { DRAFT_INSERT_PAYLOAD_OMIT_KEYS, omitDraftInsertOnlyFields } from "./draftListingInsertContract";

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
  };
}

/** Insert payload for a private draft row (not moderated, not public inventory). */
export function buildDraftListingPayload({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const core = buildListingCoreFields({ form, authUserId, linkedUnitId });
  const title = core.title || "Untitled draft";
  const price = Number.isFinite(core.price) && core.price > 0 ? core.price : 0;

  const { body } = omitDraftInsertOnlyFields({
    ...core,
    title,
    price,
    status: "draft",
  });
  return body;
}

/**
 * PATCH payload for draft → pending review (step 5). Core listing fields + lifecycle only;
 * omits user_id and unapplied enrichment columns (see listingsSchemaAllowlist).
 */
export function buildSubmitForReviewPatch({
  form,
  authUserId,
  linkedUnitId = "",
}) {
  const nowIso = new Date().toISOString();
  const core = buildListingCoreFields({ form, authUserId, linkedUnitId });
  const { body } = omitSubmitForReviewWorkflowFields({
    ...core,
    ...buildSubmitForReviewStatusPatch(),
    updated_at: nowIso,
  });
  return body;
}

/** Partial update while staying in draft (controlled saves). Omits ownership ids — unchanged server-side. */
export function buildDraftAutosavePayload({
  form,
  authUserId,
  linkedUnitId = "",
  sourceLifecycle = "",
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

  const lifecycleFields =
    sourceLifecycle === LISTING_LIFECYCLE.ARCHIVED
      ? buildModerationArchivePatch()
      : {
          status: "draft",
          lifecycle_status: "draft",
          moderation_status: "draft",
        };

  return {
    ...writable,
    title,
    price,
    ...lifecycleFields,
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
  const updates = buildSubmitForReviewPatch({
    form,
    authUserId,
    linkedUnitId,
  });
  const eqFilters = authUserId ? { user_id: authUserId } : {};
  const result = await executeListingUpdate(supabase, listingId, updates, {
    mutationFlow: LISTING_MUTATION_FLOW.SUBMIT_DRAFT_REVIEW,
    eqFilters,
    minimalFallback: buildSubmitForReviewMinimalFallback(),
    returnRow: true,
  });
  if (!isProd && typeof console !== "undefined" && console.info) {
    console.info("[submit-draft-review]", {
      listingId,
      appliedPayload: result.appliedPayload,
      returned: result.data,
      stage: result.meta?.stage,
      usedFallback: result.meta?.usedFallback,
    });
  }
  return result;
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

async function emitListingCreatedAfterInsert(supabase, listingRow, appliedPayload, mutationFlow) {
  const listingId = listingRow?.id;
  if (!listingId) return;

  let actorId = appliedPayload?.user_id || appliedPayload?.listed_by || null;
  if (!actorId && supabase?.auth?.getUser) {
    const { data } = await supabase.auth.getUser();
    actorId = data?.user?.id || null;
  }

  const lifecycleStatus =
    getLifecycleStatus(listingRow) ||
    appliedPayload?.lifecycle_status ||
    appliedPayload?.status ||
    null;

  await emitListingEventAfterMutation({
    client: supabase,
    listingId: String(listingId),
    eventType: LISTING_EVENT_TYPES.CREATED,
    payload: buildCreatedPayload({
      lifecycleStatus,
      title: appliedPayload?.title || listingRow?.title,
    }),
    actorId: actorId ? String(actorId) : null,
    actorRole: actorId ? "agent" : null,
  });
}

export async function safeInsertListing(supabase, payload, options = {}) {
  const mutationFlow = options.mutationFlow ?? LISTING_MUTATION_FLOW.UNSPECIFIED;
  const insertResult = await executeListingInsert(supabase, payload, {
    mutationFlow,
    resolveDistrict: resolveListingDistrictSlug,
  });

  const {
    data,
    error,
    appliedPayload,
    meta = {},
  } = insertResult;
  const { strippedKeys = [], attempts = 0, usedMinimalFinalSafe = false, stage = "" } = meta;

  if (!error && data) {
    assignBrowserInsertGlobals(null, appliedPayload);
    logInsertSuccess(usedMinimalFinalSafe ? "minimal-final-safe-success" : "success", appliedPayload, {
      attempts,
      strippedKeysHistory: strippedKeys,
      skipOwnershipEnrichment: meta.skipOwnershipEnrichment,
      usedMinimalFinalSafe,
    });
    await emitListingCreatedAfterInsert(supabase, data, appliedPayload, mutationFlow);
    return {
      data,
      error: null,
      appliedPayload,
      meta: buildInsertSuccessMeta({ strippedKeys, attempts, usedMinimalFinalSafe }),
    };
  }

  if (error) {
    logListingMutationFailureGrouped({
      operation: LISTING_MUTATION_OPERATION.INSERT,
      mutationFlow,
      stage: stage || "write-contract-failed",
      attempt: attempts,
      retryMax: 2,
      strippedKeys,
      payload: appliedPayload,
      error,
    });
    assignBrowserInsertGlobals(error, appliedPayload);
    if (!isProd) {
      await runMinimalListingInsertProbe(supabase, payload);
    }
  }

  return {
    data: null,
    error: error || new Error("Unable to insert listing safely."),
    appliedPayload,
    meta: {
      strippedKeys,
      attempts,
      usedMinimalFinalSafe: false,
      skipOwnershipEnrichment: false,
    },
  };
}

/**
 * Operational inventory counts for a user (canonical lifecycle resolution, no SQL drift).
 * Uses {@link executeListingDashboardSelectQuery} count tiers — never inline count SELECT.
 * @returns {Promise<{ active: number, pending: number, error: Error|null }>}
 */
export async function fetchUserListingOperationalCounts(supabase, userId) {
  if (!supabase || !userId) return { active: 0, pending: 0, error: null };

  const { data, error, terminal } = await executeListingDashboardSelectQuery(
    supabase,
    (select) => supabase.from("listings").select(select).eq("user_id", userId),
    {
      tiers: LISTING_DASHBOARD_COUNT_SELECT_TIERS,
      buildSelect: (tier) => buildListingDashboardCountSelect(tier),
    }
  );

  if (error) {
    logDashboardMetricFailureOnce("listings operational counts", error, {
      resource: "listings",
      operation: "select",
      filters: [{ column: "user_id", op: "eq", value: userId }],
    });
    if (terminal) {
      return { active: 0, pending: 0, error };
    }
    return { active: 0, pending: 0, error };
  }

  const { approved, pending } = tallyOperationalLifecycleCounts(data || []);
  return { active: approved, pending, error: null };
}

/**
 * Published / approved / live listings only — consumes simultaneous cap slots.
 * Pending review, draft, archived, and rejected rows are excluded.
 */
export async function getUserActiveListingCount(supabase, userId) {
  const { active, error } = await fetchUserListingOperationalCounts(supabase, userId);
  if (error) return 0;
  return active;
}

/** Permanently remove a private draft row (images + favorites + listing). */
export async function discardDraftListing(supabase, { listingId, userId }) {
  const id = String(listingId || "").trim();
  const uid = String(userId || "").trim();
  if (!id || !uid) return { error: new Error("Draft discard requires a listing and user.") };

  const { data: row, error: loadError } = await supabase
    .from("listings")
    .select("id,user_id,status,lifecycle_status,moderation_status")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { error: loadError };
  if (!row) return { error: new Error("Draft not found.") };
  if (String(row.user_id) !== uid) return { error: new Error("You cannot discard this draft.") };
  if (getLifecycleStatus(row) !== LISTING_LIFECYCLE.DRAFT) {
    return { error: new Error("Only drafts can be discarded from here.") };
  }

  await supabase.from("listing_images").delete().eq("listing_id", id);
  await supabase.from("favorites").delete().eq("listing_id", id);

  const { error: deleteError } = await supabase.from("listings").delete().eq("id", id).eq("user_id", uid);
  return { error: deleteError || null };
}
