import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { resolveNotificationDestination } from "@/lib/dashboardCrmRoutes";

/**
 * Canonical role-aware inbox destination for new_inquiry notifications.
 * Shared by push payloads and in-app notification presentation.
 *
 * @param {{
 *   recipientRole: string,
 *   payload?: object,
 *   conversationId?: string | null,
 * }} input
 */
export function resolveNewInquiryNotificationHref({
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
  };

  const href = resolveNotificationDestination({
    eventType: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
    role: recipientRole,
    payload: enrichedPayload,
  });

  if (typeof href === "string" && href.startsWith("/")) {
    return href;
  }

  const normalizedRole = String(recipientRole || "user").trim().toLowerCase();
  const inboxBase =
    normalizedRole === "admin"
      ? "/admin?tab=inbox"
      : normalizedRole === "agent"
        ? "/dashboard/agent?tab=inbox"
        : "/dashboard/user?tab=inbox";

  if (!convId) {
    return inboxBase;
  }

  const separator = inboxBase.includes("?") ? "&" : "?";
  return `${inboxBase}${separator}conversation=${encodeURIComponent(String(convId))}`;
}
