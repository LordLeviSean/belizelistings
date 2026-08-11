import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";
import { buildViewingRequestedPushCopy } from "@/lib/notifications/viewingNotificationCopy";
import { buildPushPayload } from "./pushPayload";

/**
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildViewingRequestedPushPayload({ notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildViewingRequestedPushCopy(payload);
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED}:${notificationId}`,
  });
}

/**
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 * }} input
 */
export function resolveViewingRequestedPushDestination({ recipientRole, payload = {} }) {
  return resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED,
    role: recipientRole,
    payload,
  });
}
