import { BL_ENABLE_NOTIFICATIONS } from "../featureFlags";
import { isCrmUnavailable } from "../crm/crmCompat";
import { deliverAfterEnqueue } from "./deliverNotifications";

/** Structured notification event types (Workstream G). */
export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  NEW_INQUIRY: "new_inquiry",
  AGENT_REPLIED: "agent_replied",
  VIEWING_REQUESTED: "viewing_requested",
  VIEWING_CONFIRMED: "viewing_confirmed",
  VIEWING_CANCELLED: "viewing_cancelled",
  VIEWING_DECLINED: "viewing_declined",
  VIEWING_RESCHEDULED: "viewing_rescheduled",
  VIEWING_COMPLETED: "viewing_completed",
  INQUIRY_ARCHIVED: "inquiry_archived",
  GEOGRAPHIC_UPDATE_V1: "geographic_update_v1",
  LISTING_MARKED_SOLD: "listing_marked_sold",
  LISTING_MARKED_RENTED: "listing_marked_rented",
  LISTING_AUTO_ARCHIVED: "listing_auto_archived",
  LISTING_APPROVED: "listing_approved",
  LISTING_REJECTED: "listing_rejected",
  AGENT_UPGRADE_SUBMITTED: "agent_upgrade_submitted",
  AGENT_UPGRADE_REQUESTED: "agent_upgrade_requested",
});

/**
 * Enqueue a notification for future delivery (email/push/in-app).
 * Inserts into notification_queue when table exists; optionally delivers to inbox when flag on.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ eventType: string, recipientId?: string, recipientEmail?: string, payload?: object }} params
 * @param {{ deliver?: boolean }} [options]
 */
export async function enqueueNotificationEvent(
  client,
  { eventType, recipientId, recipientEmail, payload = {} },
  { deliver = BL_ENABLE_NOTIFICATIONS } = {}
) {
  if (!client?.rpc || !eventType) {
    return { ok: false, skipped: true };
  }

  const { data, error } = await client.rpc("enqueue_notification_event", {
    p_event_type: eventType,
    p_recipient_id: recipientId ?? null,
    p_recipient_email: recipientEmail ?? null,
    p_payload: payload,
  });

  if (error) {
    if (isCrmUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    if (typeof console !== "undefined") {
      console.warn("[notifications] enqueue failed", { eventType, message: error.message });
    }
    return { ok: false, error };
  }

  const result = data && typeof data === "object" ? data : {};
  const queueId = result.queue_id ?? result.queueId ?? null;
  let delivery = null;

  if (deliver && queueId) {
    delivery = await deliverAfterEnqueue(client, queueId);
  }

  return { ok: true, queueId, delivery };
}

/**
 * Deliver pending queue items in batch (service-role or authenticated RPC).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ limit?: number }} [options]
 */
export async function triggerNotificationDelivery(client, { limit = 50 } = {}) {
  const { processNotificationQueueBatch } = await import("./deliverNotifications");
  return processNotificationQueueBatch(client, { limit });
}
