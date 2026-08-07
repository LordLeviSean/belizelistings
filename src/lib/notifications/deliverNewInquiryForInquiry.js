/**
 * Server-only targeted delivery for a single new_inquiry event.
 */

import { NOTIFICATION_EVENT_TYPES } from "../notifications/notificationEvents";
import { deliverNotificationQueueItemWithPush } from "./deliverNotificationsServer";
import { deliverNewInquiryWebPush } from "../push/deliverNewInquiryWebPush";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {{ inquiryId?: string|null, conversationId?: string|null, queueId?: string|null }} params
 */
export async function deliverNewInquiryNotificationForInquiry(
  adminClient,
  { inquiryId = null, conversationId = null, queueId = null } = {}
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

  let resolvedQueueId = null;

  if (inquiryId) {
    const { data: queueRows } = await adminClient
      .from("notification_queue")
      .select("id,status,event_type,payload,created_at")
      .eq("event_type", NOTIFICATION_EVENT_TYPES.NEW_INQUIRY)
      .contains("payload", { inquiry_id: inquiryId })
      .order("created_at", { ascending: false })
      .limit(1);

    const queueRow = Array.isArray(queueRows) ? queueRows[0] : null;
    if (queueRow?.id) {
      resolvedQueueId = queueRow.id;
      if (queueRow.status === "pending" || queueRow.status === "processing") {
        const delivery = await deliverNotificationQueueItemWithPush(adminClient, queueRow.id);
        return {
          ok: Boolean(delivery.ok),
          path: "queue_inquiry",
          queueId: queueRow.id,
          delivery,
        };
      }
    }
  }

  const { data: notificationRows } = await adminClient
    .from("notifications")
    .select("id,recipient_user_id,dedupe_key,event_type,payload,created_at")
    .eq("event_type", NOTIFICATION_EVENT_TYPES.NEW_INQUIRY)
    .order("created_at", { ascending: false })
    .limit(5);

  const notification = (notificationRows || []).find((row) => {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? row.payload
        : {};
    if (inquiryId && String(payload.inquiry_id || payload.inquiryId) === String(inquiryId)) {
      return true;
    }
    if (
      conversationId &&
      String(payload.conversation_id || payload.conversationId) === String(conversationId)
    ) {
      return true;
    }
    return false;
  });

  if (!notification?.id) {
    return { ok: true, skipped: true, reason: "notification_not_found" };
  }

  const push = await deliverNewInquiryWebPush(adminClient, {
    ok: true,
    event_type: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
    recipient_id: notification.recipient_user_id,
    notification_id: notification.id,
    dedupe_key: notification.dedupe_key,
  });

  return {
    ok: true,
    path: "notification_push_only",
    queueId: resolvedQueueId,
    notificationId: notification.id,
    push,
  };
}
