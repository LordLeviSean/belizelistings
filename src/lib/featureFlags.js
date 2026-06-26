/**
 * Public env flags (Next.js inlines `NEXT_PUBLIC_*` at build time).
 *
 * Use static `process.env.NEXT_PUBLIC_*` references — dynamic `process.env[name]`
 * is not substituted in client bundles, so flags would stay false in production.
 *
 * `NEXT_PUBLIC_BL_ENABLE_INQUIRIES` — user dashboard `listing_inquiries` count + realtime.
 * Default when **unset** or empty: **false** (no probe, no subscription, safe for missing table).
 * Enable only after `listing_inquiries` exists in PostgREST: set to `1` or `true` (case-insensitive).
 */
export function readTruthyEnvValue(raw) {
  if (raw == null || String(raw).trim() === "") return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true";
}

export const BL_ENABLE_INQUIRIES = readTruthyEnvValue(
  process.env.NEXT_PUBLIC_BL_ENABLE_INQUIRIES
);

/**
 * `NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS` — append/read listing_events via RPC.
 * Default when unset: false (safe when migration not applied).
 */
export const BL_ENABLE_LISTING_EVENTS = readTruthyEnvValue(
  process.env.NEXT_PUBLIC_BL_ENABLE_LISTING_EVENTS
);

/**
 * `NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS` — CRM conversations + messages + inbox v2.
 * Default when unset: false.
 */
export const BL_ENABLE_CONVERSATIONS = readTruthyEnvValue(
  process.env.NEXT_PUBLIC_BL_ENABLE_CONVERSATIONS
);

/**
 * `NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST` — persist ListingViewingBookingModal to viewing_requests.
 * Default when unset: false.
 */
export const BL_ENABLE_VIEWING_PERSIST = readTruthyEnvValue(
  process.env.NEXT_PUBLIC_BL_ENABLE_VIEWING_PERSIST
);

/**
 * `NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS` — durable in-app notifications inbox + queue delivery.
 * Default when unset: false. Enable after notification delivery migration (Stage 4).
 */
export const BL_ENABLE_NOTIFICATIONS = readTruthyEnvValue(
  process.env.NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS
);
