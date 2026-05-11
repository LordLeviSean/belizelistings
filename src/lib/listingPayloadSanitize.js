/**
 * Removes frontend-only / drifted keys before listings INSERT or PATCH.
 * `listings` uses primary key `id` — never persist a separate property FK here.
 */

import { ALLOWED_LISTINGS_COLUMN_KEYS } from "../constants/listingsSchemaAllowlist";
import { LISTING_MUTATION_FLOW } from "./listingMutationDiagnostics";

const isProd =
  typeof process !== "undefined" && process.env.NODE_ENV === "production";

let warnedPropertyIdStrip = false;

const warnedUnknownListingColumns = new Set();

/** Create-workspace diagnostic flows — log final PATCH/INSERT keys in development only. */
const PAYLOAD_KEY_LOG_FLOWS = new Set([
  LISTING_MUTATION_FLOW.DRAFT_AUTOSAVE,
  LISTING_MUTATION_FLOW.CONTINUE,
  LISTING_MUTATION_FLOW.SUBMIT,
  LISTING_MUTATION_FLOW.SUBMIT_DRAFT_REVIEW,
]);

/** Returns a shallow clone without `property_id` when present. Dev: warns once. */
export function stripPropertyIdFromListingPayload(payload) {
  if (payload == null || typeof payload !== "object") return payload;
  if (!Object.prototype.hasOwnProperty.call(payload, "property_id")) return payload;
  if (!isProd && typeof console !== "undefined" && console.warn) {
    if (!warnedPropertyIdStrip) {
      warnedPropertyIdStrip = true;
      console.warn(
        "[listings] Stripped unsupported `property_id` from listing mutation payload (listings use `id` only)."
      );
    }
  }
  const { property_id: _removed, ...rest } = payload;
  return rest;
}

/**
 * Keeps only columns present on the live listings table (see listingsSchemaAllowlist).
 * Warns once per unknown column name across the session.
 * @param {object} payload
 * @param {{ mutationFlow?: string, operation?: string }} [options]
 */
export function sanitizeListingMutationPayload(payload, options = {}) {
  if (payload == null || typeof payload !== "object") return payload;
  const base = stripPropertyIdFromListingPayload({ ...payload });
  const out = {};
  for (const key of Object.keys(base)) {
    if (ALLOWED_LISTINGS_COLUMN_KEYS.has(key)) {
      out[key] = base[key];
    } else if (!warnedUnknownListingColumns.has(key)) {
      warnedUnknownListingColumns.add(key);
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[listings-schema-guard] stripped unknown column: ${key}`);
      }
    }
  }

  const { mutationFlow = "", operation = "", logKeys } = options;
  const shouldLogKeys =
    logKeys === true ||
    (Boolean(mutationFlow) && PAYLOAD_KEY_LOG_FLOWS.has(mutationFlow));
  if (shouldLogKeys && typeof console !== "undefined" && console.info && !isProd) {
    const sorted = Object.keys(out).slice().sort();
    console.info(
      `[listing-payload-keys] flow=${mutationFlow || "n/a"} op=${operation || "n/a"} keys=${JSON.stringify(sorted)}`
    );
  }

  return out;
}

/** For tests / tooling — reset one-time guard warnings. */
export function resetListingSchemaGuardWarningsForTests() {
  warnedUnknownListingColumns.clear();
}
