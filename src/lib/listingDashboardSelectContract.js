/**
 * Canonical PostgREST `public.listings` contract for owner/user dashboards.
 *
 * ## Confirmed base columns (inventory + lifecycle)
 * id, user_id, title, price, district, region_slug, subregion_slug, created_at, updated_at,
 * status, lifecycle_status, moderation_status
 *
 * ## Optional intel (not in repo migrations — tier-stripped on schema-cache 400)
 * view_count, favorite_count, inquiry_count
 *
 * ## Forbidden on dashboard SELECT
 * select(*), occupied_at, vacancy_status, verification_* on listings
 *
 * Do not add inline `.from("listings").select(...)` in user dashboard paths — use
 * {@link executeListingDashboardSelectQuery} or fetch helpers in `listingQueries.js`.
 */

import {
  isMissingColumnError,
  isMissingRelationshipError,
  isTerminalListingQueryError,
} from "./supabaseCompat";

/** Migration-confirmed owner-dashboard columns. */
export const LISTING_DASHBOARD_BASE_COLUMNS = Object.freeze([
  "id",
  "user_id",
  "title",
  "price",
  "district",
  "region_slug",
  "community_id",
  "map_region_slug",
  "locality_id",
  "highway_id",
  "highway_mile",
  "subregion_slug",
  "created_at",
  "updated_at",
  "status",
  "lifecycle_status",
  "moderation_status",
]);

/** Optional analytics — omitted when absent in Postgres. */
export const LISTING_DASHBOARD_INTEL_COLUMNS = Object.freeze([
  "view_count",
  "favorite_count",
  "inquiry_count",
]);

/** Metrics / cap counts (subset of base). */
export const LISTING_DASHBOARD_COUNT_COLUMNS =
  "id,status,lifecycle_status,moderation_status";

export const LISTING_DASHBOARD_COUNT_COLUMNS_LEGACY = "id,status";

export const LISTING_DASHBOARD_IMAGES_EMBED = "listing_images(id,image_url,position)";

export const LISTING_DASHBOARD_MINIMAL_COLUMNS = [
  "id",
  "user_id",
  "title",
  "price",
  "district",
  "created_at",
  "status",
].join(", ");

/** Legacy DBs without lifecycle / region slugs — status-only lifecycle resolution. */
export const LISTING_DASHBOARD_LEGACY_BASE_COLUMNS = Object.freeze([
  "id",
  "user_id",
  "title",
  "price",
  "district",
  "created_at",
  "updated_at",
  "status",
]);

/** Count-only tiers for {@link fetchUserListingOperationalCounts} — legacy first (one network round-trip on older schemas). */
export const LISTING_DASHBOARD_COUNT_SELECT_TIERS = Object.freeze([
  { count: "legacy" },
  { count: "full" },
]);

/** sessionStorage cache version — bump when {@link LISTING_DASHBOARD_SELECT_TIERS} order/shape changes. */
export const LISTING_DASHBOARD_TIER_CACHE_VERSION = 4;
export const LISTING_DASHBOARD_TIER_CACHE_KEY = "bl-listing-dashboard-select-tier";
export const LISTING_CREATE_WORKSPACE_TIER_CACHE_KEY = "bl-listing-create-workspace-select-tier";
const SCHEMA_LEGACY_HINT_KEY = "bl-listing-dashboard-legacy-schema";

/** Create workspace draft hydrate — explicit allowlist (not select(*)). */
export const LISTING_CREATE_WORKSPACE_COLUMNS = Object.freeze([
  ...LISTING_DASHBOARD_BASE_COLUMNS,
  "property_type",
  "listing_type",
  "beds",
  "baths",
  "description",
  "features",
  "amenities",
  "square_feet",
  "market_type",
  "category",
  "listed_by",
]);

export const LISTING_CREATE_WORKSPACE_MINIMAL_COLUMNS = [
  "id",
  "user_id",
  "title",
  "price",
  "district",
  "created_at",
  "status",
  "property_type",
  "listing_type",
  "beds",
  "baths",
  "description",
  "features",
  "amenities",
  "square_feet",
].join(", ");

export const LISTING_CREATE_WORKSPACE_SELECT_TIERS = Object.freeze([
  { withImages: true, workspace: true },
  { withImages: false, workspace: true },
  { minimal: true, workspace: true },
]);

/** Back-compat aliases (prefer LISTING_DASHBOARD_* in new code). */
export const LISTING_OWNER_DASHBOARD_COLUMNS = LISTING_DASHBOARD_BASE_COLUMNS.join(", ");
export const LISTING_OWNER_DASHBOARD_COLUMNS_WITH_INTEL = [
  ...LISTING_DASHBOARD_BASE_COLUMNS,
  ...LISTING_DASHBOARD_INTEL_COLUMNS,
].join(", ");
export const LISTING_OWNER_DASHBOARD_IMAGES_EMBED = LISTING_DASHBOARD_IMAGES_EMBED;

const FORBIDDEN_DASHBOARD_SELECT_SNIPPETS = [
  "occupied_at",
  "vacancy_status",
  "verification_status",
  "inventory_verification_status",
  "closing_verification_status",
];

/**
 * Ordered degradation: embed-off and legacy-before-full so the first network attempt succeeds
 * on common schemas (missing embed or lifecycle columns). Intel tiers omitted — not in migrations.
 * @type {ReadonlyArray<{ withImages?: boolean, withIntel?: boolean, legacyBase?: boolean, minimal?: boolean }>}
 */
export const LISTING_DASHBOARD_SELECT_TIERS = Object.freeze([
  { withImages: false, withIntel: false },
  { legacyBase: true, withImages: false },
  { withImages: true, withIntel: false },
  { legacyBase: true, withImages: true },
  { minimal: true },
]);

function readTierCacheIndex(tierCount, tierCacheKey = LISTING_DASHBOARD_TIER_CACHE_KEY) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(tierCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== LISTING_DASHBOARD_TIER_CACHE_VERSION) return null;
    const i = parsed?.i;
    if (Number.isInteger(i) && i >= 0 && i < tierCount) return i;
  } catch {
    /* ignore */
  }
  return null;
}

function writeTierCacheIndex(index, tierCacheKey = LISTING_DASHBOARD_TIER_CACHE_KEY) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      tierCacheKey,
      JSON.stringify({ v: LISTING_DASHBOARD_TIER_CACHE_VERSION, i: index })
    );
  } catch {
    /* ignore */
  }
}

function readLegacySchemaHint() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SCHEMA_LEGACY_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLegacySchemaHint() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCHEMA_LEGACY_HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * @param {ReadonlyArray<object>} tiers
 * @returns {number[]}
 */
export function buildListingDashboardTierAttemptOrder(
  tiers,
  { tierCacheKey = LISTING_DASHBOARD_TIER_CACHE_KEY } = {}
) {
  const indices = tiers.map((_, i) => i);
  if (readLegacySchemaHint()) {
    const legacy = [];
    const rest = [];
    for (const i of indices) {
      if (tiers[i]?.legacyBase || tiers[i]?.minimal) legacy.push(i);
      else rest.push(i);
    }
    return [...legacy, ...rest];
  }
  const cached = readTierCacheIndex(tiers.length, tierCacheKey);
  if (cached != null) {
    return [cached, ...indices.filter((i) => i !== cached)];
  }
  return indices;
}

/**
 * @param {{ count?: "full"|"legacy" }} [opts]
 * @returns {string}
 */
export function buildListingDashboardCountSelect({ count = "full" } = {}) {
  return count === "legacy" ? LISTING_DASHBOARD_COUNT_COLUMNS_LEGACY : LISTING_DASHBOARD_COUNT_COLUMNS;
}

/**
 * @param {{ withImages?: boolean, withIntel?: boolean, legacyBase?: boolean, minimal?: boolean, workspace?: boolean }} [opts]
 * @returns {string}
 */
export function buildListingDashboardSelect({
  withImages = true,
  withIntel = false,
  minimal = false,
  legacyBase = false,
  workspace = false,
} = {}) {
  if (workspace && minimal) return LISTING_CREATE_WORKSPACE_MINIMAL_COLUMNS;
  if (workspace) {
    const cols = LISTING_CREATE_WORKSPACE_COLUMNS.join(", ");
    if (!withImages) return cols;
    return `${cols}, ${LISTING_DASHBOARD_IMAGES_EMBED}`;
  }
  if (minimal) return LISTING_DASHBOARD_MINIMAL_COLUMNS;
  const baseCols = legacyBase ? LISTING_DASHBOARD_LEGACY_BASE_COLUMNS : LISTING_DASHBOARD_BASE_COLUMNS;
  const cols = withIntel
    ? [...baseCols, ...LISTING_DASHBOARD_INTEL_COLUMNS].join(", ")
    : baseCols.join(", ");
  if (!withImages) return cols;
  return `${cols}, ${LISTING_DASHBOARD_IMAGES_EMBED}`;
}

/** @deprecated use buildListingDashboardSelect */
export function buildOwnerDashboardListingsSelect(opts) {
  return buildListingDashboardSelect(opts);
}

/** @param {unknown} error */
export function isRecoverableListingDashboardSelectError(error) {
  return isMissingColumnError(error) || isMissingRelationshipError(error);
}

/**
 * @param {object[]} rows
 * @returns {object[]}
 */
/** Ensures embed fallback always yields an array (legacy normalize runs in listingQueries). */
export function normalizeListingDashboardRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    listing_images: Array.isArray(row?.listing_images) ? row.listing_images : [],
  }));
}

/**
 * Tiered owner-dashboard SELECT with embed/column fallbacks — never hard-fails on embed alone.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {(select: string) => Promise<{ data: object|object[]|null, error: unknown|null }>} runQuery
 * @returns {Promise<{ data: object[], error: unknown|null, terminal: boolean }>}
 */
export async function executeListingDashboardSelectQuery(
  supabaseClient,
  runQuery,
  {
    tiers = LISTING_DASHBOARD_SELECT_TIERS,
    buildSelect = buildListingDashboardSelect,
    tierCacheKey = LISTING_DASHBOARD_TIER_CACHE_KEY,
  } = {}
) {
  if (!supabaseClient) {
    return { data: [], error: null, terminal: false };
  }

  const attemptOrder = buildListingDashboardTierAttemptOrder(tiers, { tierCacheKey });
  let lastError = null;
  for (const tierIndex of attemptOrder) {
    const tier = tiers[tierIndex];
    const select = buildSelect(tier);
    const { data, error } = await runQuery(select);
    if (!error) {
      writeTierCacheIndex(tierIndex, tierCacheKey);
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return { data: normalizeListingDashboardRows(rows), error: null, terminal: false };
    }
    lastError = error;
    if (
      isRecoverableListingDashboardSelectError(error) &&
      !tier?.legacyBase &&
      !tier?.minimal &&
      isMissingColumnError(error)
    ) {
      writeLegacySchemaHint();
    }
    if (!isRecoverableListingDashboardSelectError(error)) {
      const terminal = isTerminalListingQueryError(error);
      return { data: [], error, terminal };
    }
  }

  const terminal = isTerminalListingQueryError(lastError);
  return { data: [], error: lastError, terminal };
}

/**
 * Guard contract literals (tests / audit).
 * @param {string} selectLiteral
 * @returns {string[]}
 */
export function auditListingDashboardSelectLiteral(selectLiteral) {
  const violations = [];
  const lit = String(selectLiteral || "").trim();
  if (!lit) return violations;
  if (lit === "*") violations.push("select(*) is forbidden");
  for (const bad of FORBIDDEN_DASHBOARD_SELECT_SNIPPETS) {
    if (lit.includes(bad)) violations.push(`forbidden column snippet: ${bad}`);
  }
  return violations;
}
