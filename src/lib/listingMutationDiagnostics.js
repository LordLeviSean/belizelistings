/**
 * Grouped console diagnostics for listing INSERT/PATCH — ops debugging only (no UI impact).
 */

import { extractMissingColumnName } from "./supabaseCompat";
import { snapshotSupabaseError } from "./supabaseRawError";

export const LISTING_MUTATION_OPERATION = {
  INSERT: "INSERT",
  PATCH: "PATCH",
};

/** Caller-supplied UX flow (create workspace and related paths). */
export const LISTING_MUTATION_FLOW = {
  DRAFT_AUTOSAVE: "draft-autosave",
  CONTINUE: "continue",
  SUBMIT: "submit",
  SUBMIT_DRAFT_REVIEW: "submit-draft-review",
  DIRECT_CREATE: "direct-create",
  UNSPECIFIED: "unspecified",
};

function clonePayload(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return value ?? null;
  }
}

/**
 * Human-readable grouped log matching ops checklist.
 * @param {object} params
 * @param {'INSERT'|'PATCH'} params.operation
 * @param {string} [params.mutationFlow]
 * @param {string} [params.stage]
 * @param {number} [params.attempt]
 * @param {number} [params.retryMax]
 * @param {string[]} [params.strippedKeys]
 * @param {object|null} [params.payload]
 * @param {unknown} [params.error]
 */
export function logListingMutationFailureGrouped({
  operation,
  mutationFlow = LISTING_MUTATION_FLOW.UNSPECIFIED,
  stage = "",
  attempt = 0,
  retryMax = null,
  strippedKeys = [],
  payload = null,
  error = null,
}) {
  if (typeof console === "undefined") return;

  const headline = operation === LISTING_MUTATION_OPERATION.PATCH ? "[listing-patch]" : "[listing-insert]";
  const remainingKeys = Object.keys(payload || {}).slice().sort();
  const parsedMissingColumn = extractMissingColumnName(error);
  const label = `${headline} ${stage || "failure"} · attempt ${attempt}${retryMax != null ? `/${retryMax}` : ""}`;

  console.groupCollapsed(label);
  console.log("operation:", operation);
  console.log("mutationFlow:", mutationFlow);
  console.log("attempt:", attempt);
  console.log("stripped keys:", [...strippedKeys]);
  console.log("remaining keys:", remainingKeys);
  console.log("parsed missing column:", parsedMissingColumn || null);
  console.log("supabase error:", error != null ? snapshotSupabaseError(error) : null);
  console.log("payload:", clonePayload(payload));
  console.groupEnd();
}
