import {
  mergeViewingIntoList,
  normalizeViewingId,
  viewingListIncludesId,
} from "./viewingDeepLink";
import { fetchViewingForAgentById, fetchViewingForBuyerById } from "./viewingMutations";
import { classifyParticipantDeepLinkFetchResult } from "./participantDeepLinkOutcome";

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
 * Resolve a viewing deep link for a buyer or agent/owner participant.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} participantUserId
 * @param {string|number|null|undefined} viewingId
 * @param {Array<object>} existingViewings
 * @param {Record<string|number, object>} existingListingsById
 * @param {{ asAgent?: boolean }} [options]
 */
export async function resolveParticipantViewingDeepLink(
  client,
  participantUserId,
  viewingId,
  existingViewings = [],
  existingListingsById = {},
  { asAgent = false } = {}
) {
  const targetId = normalizeViewingId(viewingId);
  if (!client || !participantUserId || !targetId) {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      outcome: null,
      resolved: false,
      fetched: false,
      error: null,
    };
  }

  if (viewingListIncludesId(existingViewings, targetId)) {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      outcome: "resolved",
      resolved: true,
      fetched: false,
      error: null,
    };
  }

  const fetchById = asAgent ? fetchViewingForAgentById : fetchViewingForBuyerById;
  const { data, error } = await fetchById(client, participantUserId, targetId);
  const classified = classifyParticipantDeepLinkFetchResult({ data, error });
  if (classified.outcome !== "resolved") {
    return {
      viewings: existingViewings,
      listingsById: existingListingsById,
      outcome: classified.outcome,
      resolved: false,
      fetched: true,
      error: classified.error,
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
    outcome: "resolved",
    resolved: true,
    fetched: true,
    error: null,
  };
}

/** @deprecated Prefer `resolveParticipantViewingDeepLink` with `{ asAgent: false }`. */
export async function resolveBuyerViewingDeepLink(
  client,
  buyerUserId,
  viewingId,
  existingViewings = [],
  existingListingsById = {}
) {
  return resolveParticipantViewingDeepLink(
    client,
    buyerUserId,
    viewingId,
    existingViewings,
    existingListingsById,
    { asAgent: false }
  );
}

export async function resolveAgentViewingDeepLink(
  client,
  agentUserId,
  viewingId,
  existingViewings = [],
  existingListingsById = {}
) {
  return resolveParticipantViewingDeepLink(
    client,
    agentUserId,
    viewingId,
    existingViewings,
    existingListingsById,
    { asAgent: true }
  );
}
