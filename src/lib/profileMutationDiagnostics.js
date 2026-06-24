/**
 * Grouped console diagnostics for profile ensure / signup — development and opt-in only.
 */

import { snapshotSupabaseError } from "./supabaseRawError";

function cloneSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return value ?? null;
  }
}

/**
 * @param {object|null|undefined} result supabase-js mutation result { data, error, status, ... }
 * @param {object|null|undefined} payload body sent to PostgREST
 */
export function buildPostgrestMutationDetails(result, payload) {
  const err = result?.error;
  const payloadKeys =
    payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).sort() : [];

  return {
    httpStatus: result?.status ?? err?.status ?? null,
    statusText: result?.statusText ?? null,
    code: err?.code ?? result?.code ?? null,
    message: err?.message ?? null,
    details: err?.details ?? result?.details ?? null,
    hint: err?.hint ?? result?.hint ?? null,
    payloadKeys,
    payloadSnapshot: cloneSafe(payload),
    errorSnapshot: err != null ? snapshotSupabaseError(err) : null,
  };
}

export const PROFILE_ENSURE_DEBUG_STORAGE_KEY = "BL_PROFILE_ENSURE_DEBUG";

export function isProfileEnsureDiagnosticsEnabled() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage?.getItem(PROFILE_ENSURE_DEBUG_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * @param {object} params
 * @param {string} [params.flow]
 * @param {string} [params.stage]
 * @param {string} [params.userId]
 * @param {boolean} [params.hasSession]
 * @param {number} [params.attempt]
 * @param {number|null} [params.retryMax]
 * @param {object|null} [params.signUpSummary]
 * @param {object|null} [params.ensurePayload]
 * @param {unknown} [params.error]
 * @param {object|null} [params.finalProfile]
 * @param {object|null} [params.postgrest] buildPostgrestMutationDetails(...)
 * @param {object|null} [params.priorTerminal]
 */
export function logProfileEnsureGrouped({
  flow = "",
  stage = "",
  userId = "",
  hasSession = false,
  attempt = 0,
  retryMax = null,
  signUpSummary = null,
  ensurePayload = null,
  error = null,
  finalProfile = null,
  postgrest = null,
  priorTerminal = null,
}) {
  if (!isProfileEnsureDiagnosticsEnabled() || typeof console === "undefined") return;

  const label = `[profile-ensure] ${stage || "event"} · ${flow || "flow"} · attempt ${attempt}${
    retryMax != null ? `/${retryMax}` : ""
  }`;

  console.groupCollapsed(label);
  console.log("userId:", userId || null);
  console.log("hasSession:", hasSession);
  console.log("signup summary:", cloneSafe(signUpSummary));
  console.log("ensure payload:", cloneSafe(ensurePayload));
  console.log("payload column keys:", postgrest?.payloadKeys ?? (ensurePayload && typeof ensurePayload === "object" ? Object.keys(ensurePayload).sort() : null));
  console.log("postgREST / mutation:", cloneSafe(postgrest));
  console.log("prior terminal record:", cloneSafe(priorTerminal));
  console.log("error:", error != null ? snapshotSupabaseError(error) : null);
  console.log("final profile keys:", finalProfile && typeof finalProfile === "object" ? Object.keys(finalProfile).sort() : null);
  console.groupEnd();
}
