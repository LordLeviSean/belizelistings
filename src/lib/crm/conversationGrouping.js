import { CRM_PIPELINE_STAGE, INQUIRY_STATUS } from "./crmConstants";
import { isAgentConversationUnread } from "./conversationMutations";

/** Display status for owner inbox conversation rows. */
export const CONVERSATION_DISPLAY_STATUS = Object.freeze({
  NEW: "new",
  READ: "read",
  REPLIED: "replied",
});

export function getListingCoverUrl(listing) {
  const imgs = Array.isArray(listing?.listing_images) ? listing.listing_images : [];
  const sorted = [...imgs].filter(Boolean).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.image_url || "";
}

export function resolveConversationDisplayStatus(conv) {
  if (isAgentConversationUnread(conv)) return CONVERSATION_DISPLAY_STATUS.NEW;

  const inquiry = conv?.listing_inquiries;
  const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;

  if (
    conv?.last_message_role === "agent" ||
    row?.status === INQUIRY_STATUS.RESPONDED ||
    conv?.pipeline_stage === CRM_PIPELINE_STAGE.RESPONDED
  ) {
    return CONVERSATION_DISPLAY_STATUS.REPLIED;
  }

  return CONVERSATION_DISPLAY_STATUS.READ;
}

export function conversationDisplayStatusLabel(status) {
  switch (status) {
    case CONVERSATION_DISPLAY_STATUS.NEW:
      return "New";
    case CONVERSATION_DISPLAY_STATUS.REPLIED:
      return "Replied";
    default:
      return "Read";
  }
}

/**
 * Group agent/owner conversations by listing_id for the listing-grouped inbox.
 */
export function groupConversationsByListing(conversations = [], listingsById = {}) {
  const map = new Map();

  for (const conv of conversations) {
    const listingId = conv?.listing_id;
    if (listingId == null) continue;

    if (!map.has(listingId)) {
      const listing = listingsById[listingId];
      map.set(listingId, {
        listingId,
        title: listing?.title || `Listing #${listingId}`,
        thumbnailUrl: getListingCoverUrl(listing),
        conversations: [],
        unreadCount: 0,
        totalCount: 0,
        latestAt: null,
      });
    }

    const group = map.get(listingId);
    group.conversations.push(conv);
    group.totalCount += 1;
    if (isAgentConversationUnread(conv)) group.unreadCount += 1;

    const at = conv.updated_at || conv.created_at;
    if (at && (!group.latestAt || new Date(at).getTime() > new Date(group.latestAt).getTime())) {
      group.latestAt = at;
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      conversations: [...group.conversations].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime()
    );
}

export function countOwnerInboxUnread(conversations = []) {
  return (conversations || []).filter((conv) => isAgentConversationUnread(conv)).length;
}
