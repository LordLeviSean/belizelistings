import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";
import { buildPushPayload } from "./pushPayload";

export const NEW_INQUIRY_PUSH_TITLE = "New property inquiry";
export const NEW_INQUIRY_PUSH_BODY = "Someone is interested in one of your listings.";

/**
 * Privacy-conscious push payload for new_inquiry events.
 * Excludes buyer contact details and message contents.
 *
 * @param {{
 *   notificationId: string,
 *   dedupeKey?: string | null,
 *   href: string,
 * }} input
 */
export function buildNewInquiryPushPayload({ notificationId, dedupeKey, href }) {
  return buildPushPayload({
    notificationId,
    eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
    title: NEW_INQUIRY_PUSH_TITLE,
    body: NEW_INQUIRY_PUSH_BODY,
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
  const enrichedPayload = {
    ...payload,
    recipient_role: payload.recipient_role ?? payload.recipientRole ?? recipientRole,
  };

  const href = resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
    role: recipientRole,
    payload: enrichedPayload,
  });

  if (typeof href === "string" && href.startsWith("/")) {
    return href;
  }

  const normalizedRole = String(recipientRole || "user").toLowerCase();
  if (normalizedRole === "admin") return "/admin?tab=inbox";
  if (normalizedRole === "agent") return "/dashboard/agent?tab=inbox";
  return "/dashboard/user?tab=inbox";
}
