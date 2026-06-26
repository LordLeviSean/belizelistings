/**
 * Append a row to security_events (best-effort; never throws to caller).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {{
 *   eventType: string,
 *   listingId?: number | string | null,
 *   senderEmail?: string | null,
 *   ipAddress?: string | null,
 *   metadata?: Record<string, unknown>,
 *   source?: string,
 * }} payload
 */
export async function logSecurityEvent(adminClient, payload) {
  if (!adminClient?.from || !payload?.eventType) return;

  try {
    await adminClient.from("security_events").insert({
      event_type: payload.eventType,
      source: payload.source ?? "api",
      listing_id: payload.listingId != null ? Number(payload.listingId) : null,
      sender_email: payload.senderEmail ?? null,
      ip_address: payload.ipAddress ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch (e) {
    if (typeof console !== "undefined") {
      console.warn("[security] logSecurityEvent failed", e?.message || e);
    }
  }
}
