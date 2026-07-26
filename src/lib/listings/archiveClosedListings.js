/**
 * Invoke archive_expired_closed_listings RPC (service role).
 * Syncs platform_runtime_config from LISTING_CLOSED_ARCHIVE_MINUTES before archival.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
import { resolveListingClosedArchiveMinutes } from "../../constants/listingClosedLifecycle";

export async function syncListingClosedArchiveMinutesConfig(client, minutes) {
  const value = String(minutes);
  const { error } = await client.from("platform_runtime_config").upsert(
    {
      config_key: "listing_closed_archive_minutes",
      config_value: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "config_key" }
  );
  if (error) {
    return { ok: false, error };
  }
  return { ok: true, error: null };
}

export async function archiveExpiredClosedListings(client, { archiveAfterMinutes } = {}) {
  if (!client?.rpc) {
    return { ok: false, error: new Error("Supabase client unavailable") };
  }

  const minutes = archiveAfterMinutes ?? resolveListingClosedArchiveMinutes();
  const syncResult = await syncListingClosedArchiveMinutesConfig(client, minutes);
  if (!syncResult.ok) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[archive-closed-listings] config sync skipped", {
        message: syncResult.error?.message,
      });
    }
  }

  const { data, error } = await client.rpc("archive_expired_closed_listings", {
    p_archive_after_minutes: minutes,
  });
  if (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[archive-closed-listings] RPC failed", { message: error.message });
    }
    return { ok: false, error, data: null };
  }

  const payload = data && typeof data === "object" ? data : {};
  if (typeof console !== "undefined" && console.info) {
    console.info("[archive-closed-listings] batch complete", {
      eligible: payload.eligible ?? null,
      archived: payload.archived ?? null,
      notificationsQueued: payload.notificationsQueued ?? null,
      archiveAfterMinutes: minutes,
    });
  }
  return { ok: true, data: payload, error: null, archiveAfterMinutes: minutes };
}
