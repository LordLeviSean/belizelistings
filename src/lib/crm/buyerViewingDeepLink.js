import {
  mergeViewingIntoList,
  normalizeViewingId,
  viewingListIncludesId,
} from "./viewingDeepLink";
import { fetchViewingForBuyerById } from "./viewingMutations";

const LISTING_SELECT =
  "id,title,district,status,lifecycle_status,sold_at,rented_at,closed_at,listing_images(id,image_url,position)";

function indexListings(rows = []) {
  const map = {};
  for (const row of rows) {
    if (row?.id != null) map[row.id] = row;
  }
  return map;
}

/**
 * Resolve a buyer viewing deep link, fetching the exact record when absent from list data.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} buyerUserId
 * @param {string|number|null|undefined} viewingId
 * @param {Array<object>} existingViewings
 * @param {Record<string|number, object>} existingListingsById
 */
export async function resolveBuyerViewingDeepLink(
  client,
  buyerUserId,
  viewingId,
  existingViewings = [],
  existingListingsById = {}
) {
  const targetId = normalizeViewingId(viewingId);
  if (!client || !buyerUserId || !targetId) {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      resolved: false,
      fetched: false,
      error: null,
    };
  }

  if (viewingListIncludesId(existingViewings, targetId)) {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      resolved: true,
      fetched: false,
      error: null,
    };
  }

  const { data, error } = await fetchViewingForBuyerById(client, buyerUserId, targetId);
  if (error || !data?.id) {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      resolved: false,
      fetched: true,
      error: error ?? { message: "Viewing not found" },
    };
  }

  const viewings = mergeViewingIntoList(existingViewings, data);
  let listingsById = { ...existingListingsById };

  if (data.listing_id != null && !listingsById[data.listing_id]) {
    const { data: listingRow, error: listingError } = await client
      .from("listings")
      .select(LISTING_SELECT)
      .eq("id", data.listing_id)
      .maybeSingle();

    if (!listingError && listingRow?.id != null) {
      listingsById = { ...listingsById, ...indexListings([listingRow]) };
    }
  }

  return {
    viewings,
    listingsById,
    resolved: true,
    fetched: true,
    error: null,
  };
}
