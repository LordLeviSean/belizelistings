import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES, BL_ENABLE_VIEWING_PERSIST } from "../featureFlags";
import { fetchInquiriesForBuyer } from "./inquiryMutations";
import { fetchConversationsForBuyer } from "./conversationMutations";
import { fetchViewingsForBuyer } from "./viewingMutations";

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
 * Load buyer CRM tabs with batched listing enrichment (no per-viewing N+1).
 */
export async function loadBuyerCrmData(client, buyerUserId) {
  if (!client || !buyerUserId) {
    return { inquiries: [], viewings: [], conversations: [], listingsById: {}, errors: {} };
  }

  const crmTabsEnabled = BL_ENABLE_INQUIRIES || BL_ENABLE_CONVERSATIONS;
  const tasks = [];
  let inquiries = [];
  let viewings = [];
  let conversations = [];
  const errors = {};

  if (crmTabsEnabled) {
    tasks.push(
      fetchInquiriesForBuyer(client, buyerUserId).then(({ data, error }) => {
        inquiries = data || [];
        if (error) errors.inquiries = error;
      })
    );
  }

  if (BL_ENABLE_CONVERSATIONS) {
    tasks.push(
      fetchConversationsForBuyer(client, buyerUserId).then(({ data, error }) => {
        conversations = data || [];
        if (error) errors.conversations = error;
      })
    );
  }

  if (BL_ENABLE_VIEWING_PERSIST || BL_ENABLE_CONVERSATIONS) {
    tasks.push(
      fetchViewingsForBuyer(client, buyerUserId).then(({ data, error }) => {
        viewings = data || [];
        if (error) errors.viewings = error;
      })
    );
  }

  await Promise.all(tasks);

  const listingIds = [
    ...new Set(
      [
        ...inquiries.map((row) => row?.listing_id),
        ...viewings.map((row) => row?.listing_id),
        ...conversations.map((row) => row?.listing_id),
      ].filter((id) => id != null)
    ),
  ];

  let listingsById = {};
  if (listingIds.length) {
    const { data, error } = await client.from("listings").select(LISTING_SELECT).in("id", listingIds);
    if (error) errors.listings = error;
    listingsById = indexListings(data || []);
  }

  return { inquiries, viewings, conversations, listingsById, errors };
}
