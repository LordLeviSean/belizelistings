import { resolveNotificationDestination, resolveGeographicUpdateListingsHref } from "@/lib/dashboardCrmRoutes";
import { formatViewingSlotLabel } from "@/lib/crm/viewingConversationMessages";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

/** Editorial categories — calm luxury, operational tone. */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  INQUIRY: "inquiry",
  MODERATION: "moderation",
  LISTING_EVENT: "listing_event",
  SYSTEM: "system",
  GUIDANCE: "guidance",
});

/**
 * Build presentation fields for a notification event.
 * Mirrors SQL `notification_presentation_for_event` for client-side previews/tests.
 *
 * @param {string} eventType
 * @param {Record<string, unknown>} [payload]
 * @returns {{ category: string, title: string, body: string, entityType: string|null, entityId: string|null, dedupeKey: string, href: string }}
 */
export function buildNotificationPresentation(eventType, payload = {}) {
  const inquiryId = payload.inquiry_id ?? payload.inquiryId ?? null;
  const conversationId = payload.conversation_id ?? payload.conversationId ?? null;
  const listingId = payload.listing_id ?? payload.listingId ?? null;
  const viewingId = payload.viewing_id ?? payload.viewingId ?? null;
  const messageId = payload.message_id ?? payload.messageId ?? null;
  const inquiryType = payload.inquiry_type ?? payload.inquiryType ?? "general";
  const explicitDedupe = payload.dedupe_key ?? payload.dedupeKey ?? null;
  const recipientRole = payload.recipient_role ?? payload.recipientRole ?? null;

  let category = NOTIFICATION_CATEGORIES.SYSTEM;
  let title = "Operational update";
  let body = "Something changed in your BelizeListings workspace.";
  let entityType = null;
  let entityId = null;
  let dedupeKey = explicitDedupe;
  let href = "/dashboard/user";

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.NEW_INQUIRY:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "New inquiry on your listing";
      body =
        inquiryType === "schedule_viewing"
          ? "A buyer requested a viewing time."
          : "A buyer left a note—your response keeps the conversation moving.";
      entityType = "inquiry";
      entityId = inquiryId ? String(inquiryId) : conversationId ? String(conversationId) : null;
      dedupeKey = dedupeKey ?? `new_inquiry:${inquiryId ?? conversationId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "agent",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Your agent replied";
      body = "A new message is waiting in your conversation.";
      entityType = "conversation";
      entityId = conversationId ? String(conversationId) : null;
      dedupeKey = dedupeKey ?? `agent_replied:${conversationId ?? ""}:${messageId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "user",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "New viewing request";
      {
        const listingTitle = payload.listing_title ?? payload.listingTitle ?? "your listing";
        const slotLabel =
          payload.slot_label ??
          payload.slotLabel ??
          formatViewingSlotLabel(payload.requested_date, payload.requested_time);
        body = slotLabel
          ? `A buyer requested a viewing for ${listingTitle} on ${slotLabel}.`
          : `A buyer requested a viewing for ${listingTitle}.`;
      }
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_requested:${viewingId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "agent",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing confirmed";
      body = "Your requested viewing time has been confirmed.";
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_confirmed:${viewingId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "user",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing cancelled";
      body = "A scheduled viewing was cancelled.";
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_cancelled:${viewingId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "user",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing declined";
      body = "The agent could not accommodate your requested viewing time.";
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_declined:${viewingId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "user",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing reschedule proposed";
      body = "A new time was proposed for your viewing — review and respond.";
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_rescheduled:${viewingId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "user",
        payload,
      });
      break;

    case NOTIFICATION_EVENT_TYPES.GEOGRAPHIC_UPDATE_V1:
      category = NOTIFICATION_CATEGORIES.GUIDANCE;
      title = "Welcome to the Geographic Update! V1.0";
      body =
        "BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.";
      entityType = "system";
      entityId = "geographic-update-v1";
      dedupeKey = dedupeKey ?? "geographic_update_v1:2026-07-13";
      href = resolveGeographicUpdateListingsHref(recipientRole || role || "user");
      break;

    case NOTIFICATION_EVENT_TYPES.INQUIRY_ARCHIVED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Inquiry archived";
      body = "An inquiry was moved to your archive.";
      entityType = "inquiry";
      entityId = inquiryId ? String(inquiryId) : null;
      dedupeKey = dedupeKey ?? `inquiry_archived:${inquiryId ?? ""}`;
      href = resolveNotificationDestination({
        eventType,
        role: recipientRole || "agent",
        payload,
      });
      break;

    default:
      if (listingId) {
        entityType = "listing";
        entityId = String(listingId);
      }
      dedupeKey = dedupeKey ?? `${eventType}:${JSON.stringify(payload)}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole, payload });
      break;
  }

  return { category, title, body, entityType, entityId, dedupeKey, href };
}

/**
 * Map a notifications table row to NotificationCenter item shape.
 * @param {Record<string, unknown>} row
 */
export function mapNotificationRowToCenterItem(row) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  const presentation = buildNotificationPresentation(row.event_type, payload);

  return {
    id: `notif-${row.id}`,
    notificationId: row.id,
    category: row.category || presentation.category,
    title: row.title || presentation.title,
    detail: row.body || presentation.body,
    href: presentation.href,
    when: row.created_at,
    unread: !row.read_at,
  };
}
