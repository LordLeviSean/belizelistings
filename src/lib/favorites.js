import { supabase } from "./supabaseClient";

function isDuplicateFavorite(error) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return String(error.message || "").toLowerCase().includes("duplicate key");
}

export async function addFavorite(listingId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { data: null, error: authError };
  if (!user?.id) return { data: null, error: new Error("Not authenticated") };

  const { data, error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, listing_id: listingId })
    .select()
    .maybeSingle();

  if (isDuplicateFavorite(error)) {
    return { data: null, error: null };
  }

  return { data, error };
}

export async function removeFavorite(listingId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { error: authError };
  if (!user?.id) return { error: new Error("Not authenticated") };

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("listing_id", listingId);

  return { error };
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
    .eq("listing.status", "approved")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const listings = (data || [])
    .map((row) => row.listing)
    .filter(Boolean)
    .map((listing) => ({
      ...listing,
      images: (listing.listing_images || [])
        .filter((img) => img?.image_url)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }))
    .filter((listing) => listing.images.length > 0);

  return { data: listings, error: null };
}
