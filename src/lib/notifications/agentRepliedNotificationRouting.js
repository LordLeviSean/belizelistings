import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";

/**
 * Canonical role-aware inbox destination for agent_replied notifications.
 * Shared by push payloads and in-app notification presentation.
 *
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 *   conversationId?: string | null,
 * }} input
 */
export function resolveAgentRepliedNotificationHref({
  recipientRole,
  payload = {},
  conversationId = null,
}) {
  const convId =
    conversationId ??
    payload.conversation_id ??
    payload.conversationId ??
    null;

  const enrichedPayload = {
    ...payload,
    conversation_id: convId,
    conversationId: convId,
    recipient_role: payload.recipient_role ?? payload.recipientRole ?? recipientRole,
    recipientRole: payload.recipient_role ?? payload.recipientRole ?? recipientRole,
    recipient_side: payload.recipient_side ?? payload.recipientSide ?? "buyer",
    recipientSide: payload.recipient_side ?? payload.recipientSide ?? "buyer",
  };

  const href = resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.AGENT_REPLIED,
    role: recipientRole,
    payload: enrichedPayload,
  });

  if (typeof href === "string" && href.startsWith("/")) {
    return href;
  }

  const inboxBase = "/dashboard/user?tab=inbox";
  if (!convId) {
    return inboxBase;
  }

  return `${inboxBase}&conversation=${encodeURIComponent(String(convId))}`;
}
