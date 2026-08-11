import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { resolveAgentRepliedNotificationHref } from "./agentRepliedNotificationRouting";
import { resolveNewInquiryNotificationHref } from "./newInquiryNotificationRouting";

/**
 * Role-aware inbox destination for admin_replied notifications.
 *
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 *   conversationId?: string | null,
 * }} input
 */
export function resolveAdminRepliedNotificationHref({
  recipientRole,
  payload = {},
  conversationId = null,
}) {
  const side = String(payload.recipient_side ?? payload.recipientSide ?? "").trim().toLowerCase();
  if (side === "buyer") {
    return resolveAgentRepliedNotificationHref({ recipientRole, payload, conversationId });
  }
  return resolveNewInquiryNotificationHref({ recipientRole, payload, conversationId });
}

export { NOTIFICATION_EVENT_TYPES };
