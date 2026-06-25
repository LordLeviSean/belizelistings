/**
 * Public env flags (Next.js inlines `NEXT_PUBLIC_*` at build time).
 *
 * `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` — user dashboard `listing_inquiries` count + realtime.
 * Default when **unset** or empty: **false** (no probe, no subscription, safe for missing table).
 * Enable only after `listing_inquiries` exists in PostgREST: set to `1` or `true` (case-insensitive).
 */
function readTruthyPublicEnv(name) {
  if (typeof process === "undefined") return false;
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true";
}

export const BL_ENABLE_INQUIRIES = readTruthyPublicEnv("NEXT_PUBLIC_BL_ENABLE_INQUIRIES");

/**
 * `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` — append/read listing_events via RPC.
 * Default when unset: false (safe when migration not applied).
 */
export const BL_ENABLE_LISTING_EVENTS = readTruthyPublicEnv("NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS");
