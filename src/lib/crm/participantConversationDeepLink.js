import {
  conversationListIncludesId,
  mergeConversationIntoList,
  normalizeConversationId,
} from "./conversationDeepLink";
import { normalizeConversationCrmRow } from "./conversationCrmShape";
import { fetchConversationForParticipantById } from "./conversationMutations";
import { classifyParticipantDeepLinkFetchResult } from "./participantDeepLinkOutcome";

const LISTING_SELECT = "id,title,district,status,lifecycle_status";

function indexListings(rows = []) {
  const map = {};
  for (const row of rows) {
    if (row?.id != null) map[row.id] = row;
  }
  return map;
}

/**
 * Resolve a conversation deep link for a buyer or agent/owner participant.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} participantUserId
 * @param {string|number|null|undefined} conversationId
 * @param {Array<object>} existingConversations
 * @param {Record<string|number, object>} [existingListingsById]
 * @param {{ role?: "buyer"|"agent" }} [options]
 */
export async function resolveParticipantConversationDeepLink(
  client,
  participantUserId,
  conversationId,
  existingConversations = [],
  existingListingsById = {},
  { role = "buyer" } = {}
) {
  const targetId = normalizeConversationId(conversationId);
  if (!client || !participantUserId || !targetId) {
    return {
      conversations: existingConversations,
      listingsById: existingListingsById,
      outcome: null,
      resolved: false,
      fetched: false,
      error: null,
    };
  }

  if (conversationListIncludesId(existingConversations, targetId)) {
    return {
      conversations: existingConversations,
      listingsById: existingListingsById,
      outcome: "resolved",
      resolved: true,
      fetched: false,
      error: null,
    };
  }

  const { data, error } = await fetchConversationForParticipantById(
    client,
    participantUserId,
    targetId,
    { role }
  );
  const classified = classifyParticipantDeepLinkFetchResult({ data, error });
  if (classified.outcome !== "resolved") {
    return {
      conversations: existingConversations,
      listingsById: existingListingsById,
      outcome: classified.outcome,
      resolved: false,
      fetched: true,
      error: classified.error,
    };
  }

  const conversations = mergeConversationIntoList(
    existingConversations,
    normalizeConversationCrmRow(data)
  );
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
    conversations,
    listingsById,
    outcome: "resolved",
    resolved: true,
    fetched: true,
    error: null,
  };
}
