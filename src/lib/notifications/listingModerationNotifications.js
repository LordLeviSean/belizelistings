import { LISTING_LIFECYCLE } from "../../constants/operationalModel";
import { OWNERSHIP_ACTIONS } from "../../constants/ownershipModel";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

/**
 * @param {{ action: string, listingId: string|number, listingTitle?: string, moderationVersion?: string, recipientRole?: string }} params
 */
export function buildListingModerationNotificationPayload({
  action,
  listingId,
  listingTitle = "Listing",
  moderationVersion,
  recipientRole = "user",
}) {
  const isApprove = action === OWNERSHIP_ACTIONS.APPROVE || action === "approve";
  const eventType = isApprove
    ? NOTIFICATION_EVENT_TYPES.LISTING_APPROVED
    : NOTIFICATION_EVENT_TYPES.LISTING_REJECTED;
  const toStatus = isApprove ? LISTING_LIFECYCLE.PUBLISHED : LISTING_LIFECYCLE.REJECTED;
  const version = moderationVersion || new Date().toISOString();

  return {
    eventType,
    payload: {
      listing_id: listingId,
      listing_title: listingTitle,
      to_status: toStatus,
      recipient_role: recipientRole,
      dedupe_key: `${eventType}:${listingId}:${version}`,
    },
  };
}
