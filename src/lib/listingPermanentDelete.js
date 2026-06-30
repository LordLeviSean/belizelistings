import { dedupeListingImagesBucketPath } from "../utils/listingImage";
import { coerceListingIdForDb } from "./listingEvents/coerceListingId";

export const RPC_PERMANENT_DELETE = "permanently_delete_archived_listing";

const LISTING_IMAGES_BUCKET = "listing-images";
const STORAGE_PUBLIC_MARKER = "/storage/v1/object/public/";

/**
 * @param {{ message?: string } | string | null | undefined} error
 * @returns {Error}
 */
export function mapPermanentDeleteRpcError(error) {
  const msg = String(error?.message ?? error ?? "").trim();
  const lower = msg.toLowerCase();

  if (lower.includes("listing_id is required")) {
    return new Error("Listing id is required.");
  }
  if (lower.includes("authentication required")) {
    return new Error("Sign in to permanently delete this listing.");
  }
  if (/listing not found/i.test(msg)) {
    return new Error("Listing no longer exists.");
  }
  if (lower.includes("permanent deletion is restricted to archived listings")) {
    return new Error("Permanent deletion is restricted to archived listings.");
  }
  if (lower.includes("not authorized to permanently delete")) {
    return new Error("You are not allowed to permanently delete this listing.");
  }
  if (/foreign key|violates foreign key|23503/i.test(msg)) {
    return new Error("Unable to delete listing because related records still exist.");
  }

  return new Error(msg || "Unable to permanently delete listing.");
}

/**
 * @param {{ message?: string } | null | undefined} error
 */
export function isPermanentDeleteRpcUnavailable(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  return (
    msg.includes("permanently_delete_archived_listing") ||
    msg.includes("permanently_delete_listing") ||
    msg.includes("could not find the function")
  );
}

/**
 * Extract storage object paths from listing_images.image_url values.
 * @param {Array<{ image_url?: string } | string>} rows
 * @returns {string[]}
 */
export function extractListingImageStoragePaths(rows) {
  const paths = new Set();
  for (const row of rows || []) {
    const raw = typeof row === "string" ? row : row?.image_url;
    if (!raw) continue;
    const text = String(raw).trim();
    if (!text) continue;

    const markerIdx = text.indexOf(STORAGE_PUBLIC_MARKER);
    if (markerIdx >= 0) {
      const objectPath = text.slice(markerIdx + STORAGE_PUBLIC_MARKER.length).split("?")[0];
      const normalized = dedupeListingImagesBucketPath(objectPath.replace(/^\/+/, ""));
      if (normalized) paths.add(normalized);
      continue;
    }

    const unrooted = text.replace(/^\/+/, "");
    if (unrooted.startsWith(`${LISTING_IMAGES_BUCKET}/`)) {
      paths.add(dedupeListingImagesBucketPath(unrooted));
    }
  }
  return [...paths];
}

/**
 * Best-effort storage cleanup after DB rows are removed.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ image_url?: string } | string>} imageRows
 */
export async function bestEffortRemoveListingImageStorage(supabase, imageRows) {
  if (!supabase?.storage) return;
  const paths = extractListingImageStoragePaths(imageRows);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(paths);
  if (error && typeof console !== "undefined") {
    console.warn("[permanent-delete] storage cleanup skipped", error.message || error);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string | number} listingId
 */
export async function invokePermanentDeleteListingRpc(supabase, listingId) {
  const id = String(listingId || "").trim();
  if (!id) {
    return { ok: false, error: new Error("Listing id is required.") };
  }
  if (!supabase?.rpc) {
    return { ok: false, unavailable: true, error: new Error("Missing Supabase client.") };
  }

  const { error } = await supabase.rpc(RPC_PERMANENT_DELETE, {
    p_listing_id: coerceListingIdForDb(id),
  });

  if (error) {
    if (isPermanentDeleteRpcUnavailable(error)) {
      return { ok: false, unavailable: true, error: mapPermanentDeleteRpcError(error) };
    }
    return { ok: false, error: mapPermanentDeleteRpcError(error) };
  }

  return { ok: true };
}
