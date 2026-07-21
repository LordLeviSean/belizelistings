/**
 * Invoke archive_expired_closed_listings RPC (service role).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function archiveExpiredClosedListings(client) {
  if (!client?.rpc) {
    return { ok: false, error: new Error("Supabase client unavailable") };
  }

  const { data, error } = await client.rpc("archive_expired_closed_listings");
  if (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[archive-closed-listings] RPC failed", { message: error.message });
    }
    return { ok: false, error, data: null };
  }

  const payload = data && typeof data === "object" ? data : {};
  return { ok: true, data: payload, error: null };
}
