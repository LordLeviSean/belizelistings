import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { fetchConversationsForAgent } from "./conversationMutations";
import { filterInboxConversations } from "./conversationFilters";
import { fetchViewingsForAgent } from "./viewingMutations";

const LISTING_SELECT = "id,title,listing_images(id,image_url,position)";

function indexListings(rows = []) {
  const map = {};
  for (const row of rows) {
    if (row?.id != null) map[row.id] = row;
  }
  return map;
}

/**
 * Load owner-side inbox data for listing.user_id (agent_id in conversations).
 * Enriches listing titles from conversation listing_ids so threads stay visible
 * even when the owner listings query is partial.
 */
export async function loadOwnerInboxData(client, ownerUserId) {
  if (!client || !ownerUserId) {
    return {
      conversations: [],
      viewings: [],
      listingsById: {},
      errors: {},
    };
  }

  const tasks = [];
  let conversations = [];
  let viewings = [];
  const errors = {};

  if (BL_ENABLE_CONVERSATIONS) {
    tasks.push(
      fetchConversationsForAgent(client, ownerUserId).then(({ data, error }) => {
        conversations = filterInboxConversations(data || []);
        if (error) errors.conversations = error;
      })
    );
  }

  if (BL_ENABLE_VIEWING_PERSIST) {
    tasks.push(
      fetchViewingsForAgent(client, ownerUserId).then(({ data, error }) => {
        viewings = data || [];
        if (error) errors.viewings = error;
      })
    );
  }

  const listingsPromise = client
    .from("listings")
    .select(LISTING_SELECT)
    .eq("user_id", ownerUserId);

  tasks.push(
    listingsPromise.then(({ data, error }) => {
      if (error) errors.listings = error;
      return data || [];
    })
  );

  const results = await Promise.all(tasks);
  const ownedListings = results[results.length - 1] || [];
  let listingsById = indexListings(ownedListings);

  const missingIds = [
    ...new Set(
      [
        ...conversations.map((c) => c?.listing_id),
        ...viewings.map((v) => v?.listing_id),
      ].filter((id) => id != null && !listingsById[id])
    ),
  ];

  if (missingIds.length) {
    const { data: extraRows, error } = await client.from("listings").select(LISTING_SELECT).in("id", missingIds);
    if (error) errors.listingEnrichment = error;
    listingsById = { ...listingsById, ...indexListings(extraRows || []) };
  }

  return { conversations, viewings, listingsById, errors };
}
