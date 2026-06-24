import { isMissingColumnError } from "./supabaseCompat";

/**
 * Canonical PostgREST `public.profiles` contract — single source of truth.
 *
 * ## DB columns (repo migrations)
 * `supabase/migrations/*`, `supabase-migration-profiles-username.sql`:
 *   id, email, role, username, created_at, updated_at
 *
 * ## Forbidden on `profiles` (HTTP 400 / schema-cache)
 *   verification_status, agent_verification_status, verified_at,
 *   full_name, display_name, tier, brokerage_id, brokerage (embed), select(*)
 *
 * ## Session hydration lifecycle
 * 1. `UserRoleProvider` (`useUserRole.js`) is the ONLY browser identity hydrate path.
 * 2. `ensureProfile` may INSERT/UPDATE username; reads use `fetchProfileRowWithTiers`.
 * 3. `profileSessionCache` stores one row per signed-in user; survives dashboard tab changes.
 * 4. `clearProfileSession` on SIGNED_OUT and when auth user id changes (account switch).
 * 5. Admin panels use `fetchAllProfileRows` / `fetchProfileRowsByIds` — not session cache.
 * 6. API routes use minimal tier constants below (service role or bearer JWT).
 *
 * Do not add inline `.from("profiles").select(...)` outside this module.
 */

/** Widest → narrowest for signed-in session hydrate (own row). */
export const PROFILE_SELECT_TIERS = [
  "id, email, role, username, created_at, updated_at",
  "id, email, role, username",
  "id, email, role",
  "id, role",
];

/** Rows returned after client INSERT repair in ensureProfile. */
export const PROFILE_INSERT_RETURN_TIERS = [
  "id, email, role, username",
  "id, email, role",
  "id, role",
];

/** Owner / attribution lists in admin & operator panels. */
export const PROFILE_OWNER_SELECT =
  "id, username, email, role, created_at, updated_at";

/** Batch owner labels when timestamps are unavailable. */
export const PROFILE_OWNER_MINIMAL_SELECT = "id, username, email, role";

/** Server / API: role gate only. */
export const PROFILE_ROLE_ONLY_SELECT = "role";

/** Server / API: existence / uniqueness probes. */
export const PROFILE_ID_ONLY_SELECT = "id";

/** Admin create-user: username column probe. */
export const PROFILE_ID_USERNAME_PROBE_SELECT = "id, username";

/** Admin metrics: count rows without select(*). */
export const PROFILE_COUNT_HEAD_SELECT = "id";

/** Broker team scope (column may be absent — filter errors are swallowed by caller). */
export const PROFILE_BROKER_TEAM_SELECT = "id";

const PROFILE_LIST_TIERS = [
  PROFILE_OWNER_SELECT,
  PROFILE_OWNER_MINIMAL_SELECT,
  "id, email, role",
  "id, role",
];

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} userId
 * @param {string[]} [tiers]
 * @returns {Promise<{ data: object|null, error: unknown|null }>}
 */
export async function fetchProfileRowWithTiers(supabaseClient, userId, tiers = PROFILE_SELECT_TIERS) {
  let lastError = null;
  for (const columns of tiers) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select(columns)
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      return { data: data ?? null, error: null };
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      break;
    }
  }
  return { data: null, error: lastError };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string[]} [tiers]
 */
export async function fetchAllProfileRows(supabaseClient, tiers = PROFILE_LIST_TIERS) {
  let lastError = null;
  for (const columns of tiers) {
    const { data, error } = await supabaseClient.from("profiles").select(columns);
    if (!error) {
      return { data: data || [], error: null };
    }
    lastError = error;
    if (!isMissingColumnError(error)) {
      break;
    }
  }
  return { data: [], error: lastError };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string[]} ids
 * @param {string[]} [tiers]
 */
export async function fetchProfileRowsByIds(supabaseClient, ids, tiers = PROFILE_LIST_TIERS) {
  const unique = [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!unique.length) {
    return { data: [], error: null };
  }

  let lastError = null;
  for (const columns of tiers) {
    const { data, error } = await supabaseClient.from("profiles").select(columns).in("id", unique);
    if (!error) {
      return { data: data || [], error: null };
    }
    lastError = error;
    if (!isMissingColumnError(error)) {
      break;
    }
  }
  return { data: [], error: lastError };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @returns {Promise<{ count: number, error: unknown|null }>}
 */
export async function fetchProfileCount(supabaseClient) {
  const { count, error } = await supabaseClient
    .from("profiles")
    .select(PROFILE_COUNT_HEAD_SELECT, { count: "exact", head: true });
  return { count: count ?? 0, error: error ?? null };
}

/**
 * INSERT + tiered return select (ensureProfile repair path).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {object} payload
 * @param {string[]} [tiers]
 */
export async function insertProfileRowReturn(supabaseClient, payload, tiers = PROFILE_INSERT_RETURN_TIERS) {
  let lastError = null;
  for (const columns of tiers) {
    const result = await supabaseClient.from("profiles").insert(payload).select(columns).maybeSingle();
    if (!result.error) {
      return result;
    }
    lastError = result.error;
    if (!isMissingColumnError(result.error)) {
      break;
    }
  }
  return { data: null, error: lastError };
}

/**
 * Teammate ids by brokerage_id when column exists; [] if column/filter missing.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} brokerageId
 */
export async function fetchProfileIdsByBrokerageId(supabaseClient, brokerageId) {
  if (!brokerageId) return [];

  const { data, error } = await supabaseClient
    .from("profiles")
    .select(PROFILE_BROKER_TEAM_SELECT)
    .eq("brokerage_id", brokerageId);

  if (error) {
    if (isMissingColumnError(error)) return [];
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[profileSelectContract] brokerage team fetch failed", error.message);
    }
    return [];
  }

  return (data || []).map((r) => r.id).filter(Boolean);
}
