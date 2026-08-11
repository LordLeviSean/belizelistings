import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";
import { buildViewingDeclinedPushCopy } from "@/lib/notifications/viewingNotificationCopy";
import { buildPushPayload } from "./pushPayload";

/**
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 *   payload?: object,
 * }} input
 */
export function buildViewingDeclinedPushPayload({ notificationId, dedupeKey, href, payload = {} }) {
  const copy = buildViewingDeclinedPushCopy(payload);
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED,
    title: copy.title,
    body: copy.body,
    href,
    tag: dedupeKey || `${NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED}:${notificationId}`,
  });
}

/**
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 * }} input
 */
export function resolveViewingDeclinedPushDestination({ recipientRole, payload = {} }) {
  return resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED,
    role: recipientRole,
    payload,
  });
}
