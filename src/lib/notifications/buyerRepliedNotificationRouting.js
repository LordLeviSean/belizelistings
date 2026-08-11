import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { resolveNewInquiryNotificationHref } from "./newInquiryNotificationRouting";

/**
 * Owner/agent inbox destination for buyer_replied notifications.
 *
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 *   conversationId?: string | null,
 * }} input
 */
export function resolveBuyerRepliedNotificationHref({
  recipientRole,
  payload = {},
  conversationId = null,
}) {
  return resolveNewInquiryNotificationHref({ recipientRole, payload, conversationId });
}

export { NOTIFICATION_EVENT_TYPES };
