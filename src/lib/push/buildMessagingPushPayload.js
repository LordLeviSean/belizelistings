import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { buildMessagingPushCopy } from "@/lib/notifications/messagingNotificationCopy";
import { buildPushPayload } from "./pushPayload";

/**
 * @param {string} eventType
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildMessagingEventPushPayload(eventType, { notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildMessagingPushCopy(eventType, payload);
  return buildPushPayload({
    notificationId,
    eventType,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${eventType}:${notificationId}`,
  });
}

export function buildBuyerRepliedPushPayload(input) {
  return buildMessagingEventPushPayload(NOTIFICATION_EVENT_TYPES.BUYER_REPLIED, input);
}

export function buildAdminRepliedPushPayload(input) {
  return buildMessagingEventPushPayload(NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED, input);
}
