import { formatViewingSlotLabel } from "@/lib/crm/viewingConversationMessages";

export function resolveListingTitle(payload = {}, fallback = "your listing") {
  const title = payload.listing_title ?? payload.listingTitle;
  return String(title || "").trim() || fallback;
}

export function resolveSenderName(payload = {}, fallback = "A buyer") {
  const name =
    payload.sender_name ??
    payload.senderName ??
    payload.requester_name ??
    payload.requesterName;
  return String(name || "").trim() || fallback;
}

export function resolveSlotLabel(payload = {}, dateKey = "requested_date", timeKey = "requested_time") {
  const explicit = payload.slot_label ?? payload.slotLabel;
  if (explicit) return String(explicit).trim();
  const proposedDate = payload.proposed_date ?? payload.proposedDate;
  const proposedTime = payload.proposed_time ?? payload.proposedTime;
  if (proposedDate) return formatViewingSlotLabel(proposedDate, proposedTime);
  return formatViewingSlotLabel(payload[dateKey] ?? payload.requestedDate, payload[timeKey] ?? payload.requestedTime);
}

/** Notification body line with bullet between date and time: Wednesday, July 15 • 8:00 AM */
export function formatViewingSlotNotification(date, time) {
  const label = formatViewingSlotLabel(date, time);
  return label.replace(" · ", " • ");
}

export function buildViewingNotificationPayload(viewing = {}, listing = {}, extra = {}) {
  const slot = formatViewingSlotNotification(
    extra.proposed_date ?? viewing.proposed_date ?? viewing.requested_date,
    extra.proposed_time ?? viewing.proposed_time ?? viewing.requested_time
  );
  return {
    viewing_id: viewing.id ?? extra.viewing_id,
    listing_id: viewing.listing_id ?? listing.id ?? extra.listing_id,
    listing_title: listing.title ?? extra.listing_title ?? null,
    requester_name: viewing.requester_name ?? extra.requester_name ?? null,
    sender_name: viewing.requester_name ?? extra.sender_name ?? null,
    requested_date: viewing.requested_date ?? extra.requested_date,
    requested_time: viewing.requested_time ?? extra.requested_time,
    proposed_date: extra.proposed_date ?? viewing.proposed_date ?? null,
    proposed_time: extra.proposed_time ?? viewing.proposed_time ?? null,
    proposed_by: extra.proposed_by ?? viewing.proposed_by ?? null,
    slot_label: slot,
    ...extra,
  };
}

export function buildInboxMessagePayload({
  conversationId,
  messageId,
  inquiryId,
  listingId,
  listingTitle,
  senderName,
  recipientSide,
  dedupePrefix = "new_inquiry",
} = {}) {
  return {
    conversation_id: conversationId,
    message_id: messageId,
    inquiry_id: inquiryId,
    listing_id: listingId,
    listing_title: listingTitle ?? null,
    sender_name: senderName ?? null,
    recipient_side: recipientSide,
    dedupe_key: `${dedupePrefix}:${conversationId}:${messageId ?? ""}`,
  };
}
