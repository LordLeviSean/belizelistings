import { resolveNotificationDestination, resolveGeographicUpdateListingsHref } from "@/lib/dashboardCrmRoutes";
import {
  resolveListingTitle,
  resolveSenderName,
  resolveSlotLabel,
} from "@/lib/notifications/crmNotificationHelpers";
import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";

/** Editorial categories — calm luxury, operational tone. */
export const NOTIFICATION_CATEGORIES = Object.freeze({
  INQUIRY: "inquiry",
  MODERATION: "moderation",
  LISTING_EVENT: "listing_event",
  SYSTEM: "system",
  GUIDANCE: "guidance",
});

function appendSlotLine(body, slotLabel) {
  if (!slotLabel) return body;
  return `${body}\n${slotLabel}`;
}

/**
 * Build presentation fields for a notification event.
 * Mirrors SQL `notification_presentation_for_event` for client-side previews/tests.
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
  const listingTitle = resolveListingTitle(payload);
  const senderName = resolveSenderName(payload);
  const slotLabel = resolveSlotLabel(payload);

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
      if (inquiryType === "schedule_viewing") {
        title = "New viewing request";
        body = appendSlotLine(
          `${senderName} requested a viewing for ${listingTitle}.`,
          slotLabel
        );
      } else {
        title = "New message received";
        body = `${senderName} sent you a message about ${listingTitle}.`;
      }
      entityType = "conversation";
      entityId = conversationId ? String(conversationId) : inquiryId ? String(inquiryId) : null;
      dedupeKey = dedupeKey ?? `new_inquiry:${messageId ?? inquiryId ?? conversationId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "agent", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.AGENT_REPLIED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "You received a reply";
      body = `You received a reply about ${listingTitle}.`;
      entityType = "conversation";
      entityId = conversationId ? String(conversationId) : null;
      dedupeKey = dedupeKey ?? `agent_replied:${conversationId ?? ""}:${messageId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "New viewing request";
      body = appendSlotLine(
        `${senderName} requested a viewing for ${listingTitle}.`,
        slotLabel?.replace(" · ", " • ")
      );
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_requested:${viewingId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "agent", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing confirmed";
      body = appendSlotLine(
        `Your viewing for ${listingTitle} has been confirmed.`,
        slotLabel?.replace(" · ", " • ")
      );
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_confirmed:${viewingId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_CANCELLED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing cancelled";
      body = `A viewing for ${listingTitle} was cancelled.`;
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_cancelled:${viewingId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_DECLINED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing declined";
      body = `Your viewing request for ${listingTitle} was declined.`;
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_declined:${viewingId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_RESCHEDULED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      if (payload.reschedule_declined || payload.rescheduleDeclined) {
        title = "Reschedule declined";
        body = `${senderName} declined the proposed viewing time for ${listingTitle}.`;
        dedupeKey = dedupeKey ?? `viewing_reschedule_declined:${viewingId ?? ""}`;
      } else {
        title = "Viewing rescheduled";
        body = appendSlotLine(
          `A new viewing time has been proposed for ${listingTitle}.`,
          slotLabel?.replace(" · ", " • ")
        );
        dedupeKey =
          dedupeKey ??
          `viewing_rescheduled:${viewingId ?? ""}:${payload.proposed_date ?? payload.proposedDate ?? ""}`;
      }
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.VIEWING_COMPLETED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Viewing completed";
      body = `Your viewing for ${listingTitle} is marked complete.`;
      entityType = "viewing";
      entityId = viewingId ? String(viewingId) : null;
      dedupeKey = dedupeKey ?? `viewing_completed:${viewingId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "user", payload });
      break;

    case NOTIFICATION_EVENT_TYPES.GEOGRAPHIC_UPDATE_V1:
      category = NOTIFICATION_CATEGORIES.GUIDANCE;
      title = "Welcome to the Geographic Update! V1.0";
      body =
        "BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.";
      entityType = "system";
      entityId = "geographic-update-v1";
      dedupeKey = dedupeKey ?? "geographic_update_v1:2026-07-13";
      href = resolveGeographicUpdateListingsHref(recipientRole || "user");
      break;

    case NOTIFICATION_EVENT_TYPES.INQUIRY_ARCHIVED:
      category = NOTIFICATION_CATEGORIES.INQUIRY;
      title = "Inquiry archived";
      body = "An inquiry was moved to your archive.";
      entityType = "inquiry";
      entityId = inquiryId ? String(inquiryId) : null;
      dedupeKey = dedupeKey ?? `inquiry_archived:${inquiryId ?? ""}`;
      href = resolveNotificationDestination({ eventType, role: recipientRole || "agent", payload });
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
