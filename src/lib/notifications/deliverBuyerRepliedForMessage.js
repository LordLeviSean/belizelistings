/**
 * Server-only targeted delivery for a single buyer_replied event.
 */

import { NOTIFICATION_EVENT_TYPES } from "./notificationEvents";
import { deliverNotificationQueueItemWithPush } from "./deliverNotificationsServer";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {{ messageId?: string|null, queueId?: string|null }} params
 */
export async function deliverBuyerRepliedNotificationForMessage(
  adminClient,
  { messageId = null, queueId = null } = {}
) {
  if (!adminClient) {
    return { ok: false, skipped: true, reason: "invalid_client" };
  }

  if (queueId) {
    const delivery = await deliverNotificationQueueItemWithPush(adminClient, queueId);
    return {
      ok: Boolean(delivery.ok),
      path: "queue_id",
      queueId,
      delivery,
    };
  }

  if (!messageId) {
    return { ok: true, skipped: true, reason: "message_id_required" };
  }

  const { data: queueRows } = await adminClient
    .from("notification_queue")
    .select("id,status,event_type,payload,created_at")
    .eq("event_type", NOTIFICATION_EVENT_TYPES.BUYER_REPLIED)
    .contains("payload", { message_id: messageId })
    .order("created_at", { ascending: false })
    .limit(1);

  const queueRow = Array.isArray(queueRows) ? queueRows[0] : null;
  if (!queueRow?.id) {
    return { ok: true, skipped: true, reason: "queue_not_found" };
  }

  if (queueRow.status === "pending" || queueRow.status === "processing") {
    const delivery = await deliverNotificationQueueItemWithPush(adminClient, queueRow.id);
    return {
      ok: Boolean(delivery.ok),
      path: "queue_message",
      queueId: queueRow.id,
      delivery,
    };
  }

  return {
    ok: true,
    skipped: true,
    reason: "queue_already_processed",
    queueId: queueRow.id,
  };
}
