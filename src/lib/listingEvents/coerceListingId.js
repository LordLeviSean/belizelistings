/**
 * Coerce listing id for PostgREST / bigint RPC args.
 * Production `listings.id` is bigint; numeric strings must match as numbers.
 */
export function coerceListingIdForDb(listingId) {
  const s = String(listingId ?? "").trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}
