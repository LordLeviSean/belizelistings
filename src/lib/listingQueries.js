import { supabase } from "./supabaseClient";
import { getModerationStatus } from "../constants/operationalModel";
import { isMissingColumnError } from "./supabaseCompat";

/**
 * Listing fetch patterns (RLS also applies):
 * - PUBLIC (browse + listing detail): published listings.
 * - AGENT dashboard: `.eq("user_id", user.id)` with lifecycle visibility filters.
 * - ADMIN: pending-review queue, or no status filter for full moderation list.
 */

function devWarnEmptyImages(listingCount, imageRowCount) {
  if (
    typeof window === "undefined" ||
    process.env.NODE_ENV !== "development" ||
    listingCount === 0 ||
    imageRowCount > 0
  ) {
    return;
  }
  console.warn(
    "[BelizeListings] Supabase returned approved listings but zero rows from `listing_images`. " +
      "The app is connected; add rows (listing_id, image_url, position) or check RLS policies allow SELECT for anon on `listing_images`."
  );
}

/**
 * Approved listings plus related listing_images rows.
 */
export async function fetchApprovedListingsWithImages() {
  let query = supabase
    .from("listings")
    .select(`
      *,
      listing_images (*)
    `)
    .or(`status.eq.${getModerationStatus("approved")},moderation_status.eq.approved`);

  let { data, error } = await query;
  if (error && isMissingColumnError(error)) {
    query = supabase
      .from("listings")
      .select(`
        *,
        listing_images (*)
      `)
      .eq("status", getModerationStatus("approved"));
    ({ data, error } = await query);
  }

  if (error) {
    console.error("[BelizeListings] listings fetch:", error.message, error);
    return { data: [], error };
  }

  const normalized = (data || [])
    .map((listing) => ({
      ...listing,
      images: (listing.listing_images || [])
        .filter((img) => img?.image_url)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));
  const imageRowCount = normalized.reduce((sum, listing) => sum + (listing.images?.length || 0), 0);
  devWarnEmptyImages(normalized.length, imageRowCount);

  return { data: normalized, error: null };
}

export async function fetchListingByIdWithImages(id, isAdmin = false) {
  let query = supabase
    .from("listings")
    .select(`
      *,
      listing_images (
        image_url,
        position
      )
    `)
    .eq("id", id);

  if (!isAdmin) {
    query = query.or(`status.eq.${getModerationStatus("approved")},moderation_status.eq.approved`);
  }

  let { data: listing, error } = await query.maybeSingle();
  if (error && !isAdmin && isMissingColumnError(error)) {
    const fallbackQuery = supabase
      .from("listings")
      .select(`
        *,
        listing_images (
          image_url,
          position
        )
      `)
      .eq("id", id)
      .eq("status", getModerationStatus("approved"));
    ({ data: listing, error } = await fallbackQuery.maybeSingle());
  }

  if (error) {
    console.error("[BelizeListings] listing fetch:", error.message, error);
    return { data: null, error };
  }

  if (!listing) {
    return { data: null, error: null };
  }

  listing.images = (listing.listing_images || [])
    .filter((img) => img?.image_url)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && (listing.listing_images || []).length === 0) {
    console.warn(
      `[BelizeListings] No listing_images rows for listing id=${listing.id}. Add rows in Supabase or check RLS.`
    );
  }

  return {
    data: listing,
    error: null,
  };
}
