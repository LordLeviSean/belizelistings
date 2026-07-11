const ANON_VIEWER_KEY_STORAGE = "bl_listing_viewer_key";

function randomViewerKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `anon:${crypto.randomUUID()}`;
  }
  return `anon:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-browser key for deduping anonymous listing views. */
export function getOrCreateAnonViewerKey() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(ANON_VIEWER_KEY_STORAGE);
    if (existing) return existing;
    const next = randomViewerKey();
    window.sessionStorage.setItem(ANON_VIEWER_KEY_STORAGE, next);
    return next;
  } catch {
    return randomViewerKey();
  }
}

/**
 * Record a listing detail view (owner self-views excluded server-side).
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 */
export async function recordListingDetailView(client, {
  listingId,
  viewerUserId = null,
  listingOwnerUserId = null,
} = {}) {
  if (!client?.rpc || listingId == null) return { ok: false };

  if (
    viewerUserId &&
    listingOwnerUserId &&
    String(viewerUserId) === String(listingOwnerUserId)
  ) {
    return { ok: true, skipped: "owner" };
  }

  const viewerKey = viewerUserId
    ? `user:${viewerUserId}`
    : getOrCreateAnonViewerKey();
  if (!viewerKey) return { ok: false };

  const { error } = await client.rpc("record_listing_detail_view", {
    p_listing_id: Number(listingId),
    p_viewer_user_id: viewerUserId ?? null,
    p_viewer_key: viewerKey,
  });

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (error.code === "PGRST202" || msg.includes("does not exist")) {
      return { ok: false, unavailable: true };
    }
    return { ok: false, error };
  }
  return { ok: true };
}
