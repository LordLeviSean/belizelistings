import { resolveListingAgentUserId } from "./listingInquiryTargets";

export const SELF_INQUIRY_NOT_ALLOWED = "self_inquiry_not_allowed";
export const SELF_VIEWING_NOT_ALLOWED = "self_viewing_not_allowed";
export const SELF_CONTACT_NOT_ALLOWED = "self_contact_not_allowed";

export const SELF_INQUIRY_MESSAGE = "You can't contact yourself about your own listing.";
export const SELF_VIEWING_MESSAGE = "You can't schedule a viewing on your own listing.";
export const SELF_LISTING_OWNER_MESSAGE = "This is your listing.";

/** CRM recipient for inquiries and viewings — mirrors listing inquiry target resolution. */
export function resolveListingCrmRecipientUserId(listing, contact) {
  return resolveListingAgentUserId(listing, contact);
}

/**
 * True when the signed-in viewer would be both requester and recipient for CRM contact.
 * Does not treat platform admins as owners unless they own the listing row.
 */
export function isSelfListingContact({ viewerUserId, listing, recipientUserId, contact }) {
  if (!viewerUserId) return false;
  const recipient =
    recipientUserId != null && recipientUserId !== ""
      ? String(recipientUserId)
      : resolveListingCrmRecipientUserId(listing, contact);
  if (!recipient) return false;
  return String(viewerUserId) === recipient;
}

export function selfInquiryBlockedResult() {
  return {
    data: null,
    error: { code: SELF_INQUIRY_NOT_ALLOWED, message: SELF_INQUIRY_MESSAGE },
  };
}

export function selfViewingBlockedResult() {
  return {
    data: null,
    error: { code: SELF_VIEWING_NOT_ALLOWED, message: SELF_VIEWING_MESSAGE },
  };
}
