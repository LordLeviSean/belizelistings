import { supabase } from "./supabaseClient";

export async function addFavorite(listingId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { data: null, error: authError };
  if (!user?.id) return { data: null, error: new Error("Not authenticated") };

  const normalizedListingId = String(listingId ?? "");

  const { data, error } = await supabase
    .from("favorites")
    .upsert(
      {
        user_id: user.id,
        listing_id: normalizedListingId,
      },
      {
        onConflict: "user_id,listing_id",
      }
    )
    .select();

  if (error) {
    console.error("FAVORITE INSERT FAILED:", error);
    throw error;
  }

  return { data, error };
}

/** Delete every favorites row for a listing (all users). Use when a listing is published or sent back to review. */
export async function clearAllFavoritesForListing(listingId) {
  const normalized = String(listingId ?? "");
  if (!normalized) return { error: null };
  const { error } = await supabase.from("favorites").delete().eq("listing_id", normalized);
  if (error) {
    console.warn("[favorites] clearAllFavoritesForListing", normalized, error);
  }
  return { error };
}

/** Bulk variant for admin actions (e.g. bulk approve). */
export async function clearAllFavoritesForListings(listingIds) {
  const ids = [...new Set((listingIds || []).map((id) => String(id ?? "")).filter(Boolean))];
  if (!ids.length) return { error: null };
  const { error } = await supabase.from("favorites").delete().in("listing_id", ids);
  if (error) {
    console.warn("[favorites] clearAllFavoritesForListings", ids.length, error);
  }
  return { error };
}

export async function removeFavorite(listingId, { silent = false } = {}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { error: authError };
  if (!user?.id) return { error: new Error("Not authenticated") };

  const normalizedListingId = String(listingId ?? "");

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("listing_id", normalizedListingId);

  return { error, silent };
}

export async function getUserFavorites() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { data: [], error: authError };
  if (!user?.id) return { data: [], error: null };

  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      listing:listings!inner (
        *,
        listing_images (*)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const listings = (data || [])
    .map((row) => row.listing)
    .filter(Boolean)
    .map((listing) => ({
      ...listing,
      id: String(listing.id ?? ""),
      images: (listing.listing_images || [])
        .filter((img) => img?.image_url)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));

  return { data: listings, error: null };
}
