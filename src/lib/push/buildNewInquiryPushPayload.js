import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { buildMessagingPushCopy } from "@/lib/notifications/messagingNotificationCopy";
import { resolveNewInquiryNotificationHref } from "@/lib/notifications/newInquiryNotificationRouting";
import { buildPushPayload } from "./pushPayload";

export const NEW_INQUIRY_PUSH_TITLE = "New property inquiry";
export const NEW_INQUIRY_PUSH_BODY = "A buyer is interested in one of your listings.";

/**
 * Privacy-conscious push payload for new_inquiry events.
 * Excludes buyer contact details and message contents.
 *
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildNewInquiryPushPayload({ notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildMessagingPushCopy(NOTIFICATION_EVENT_TYPES.NEW_INQUIRY, payload);
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.NEW_INQUIRY}:${notificationId}`,
  });
}

/**
 * Resolve a safe inbox/conversation destination from trusted server data.
 *
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 * }} input
 */
export function resolveNewInquiryPushDestination({ recipientRole, payload = {} }) {
  return resolveNewInquiryNotificationHref({ recipientRole, payload });
}
