import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";
import { buildViewingConfirmedPushCopy } from "@/lib/notifications/viewingNotificationCopy";
import { buildPushPayload } from "./pushPayload";

/**
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildViewingConfirmedPushPayload({ notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildViewingConfirmedPushCopy(payload);
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED}:${notificationId}`,
  });
}

/**
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 * }} input
 */
export function resolveViewingConfirmedPushDestination({ recipientRole, payload = {} }) {
  return resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED,
    role: recipientRole,
    payload,
  });
}
