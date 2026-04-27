import { supabase } from "./supabaseClient";

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
  const { data: listings, error } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (
        image_url,
        position
      )
    `)
    .eq("status", "approved");

  if (error) {
    console.error("[BelizeListings] listings fetch:", error.message, error);
    return { data: [], error };
  }

  const normalized = (listings || []).map((listing) => ({
    ...listing,
    images: (listing.listing_images || [])
      .filter((img) => img.image_url)
      .sort((a, b) => a.position - b.position),
  }));
  if (!normalized.length) {
    return { data: [], error: null };
  }
  const imageRowCount = normalized.reduce((sum, listing) => sum + (listing.images?.length || 0), 0);
  devWarnEmptyImages(normalized.length, imageRowCount);

  return { data: normalized, error: null };
}

export async function fetchListingByIdWithImages(id) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (
        image_url,
        position
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[BelizeListings] listing fetch:", error.message, error);
    return { data: null, error };
  }

  if (!listing) {
    return { data: null, error: null };
  }

  listing.images = (listing.listing_images || [])
    .filter((img) => img.image_url)
    .sort((a, b) => a.position - b.position);
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
