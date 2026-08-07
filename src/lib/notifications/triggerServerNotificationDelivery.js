/**
 * Route notification queue processing through the server push pipeline.
 * Browser clients cannot invoke service-role delivery RPCs directly.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ limit?: number, queueId?: string|null, inquiryId?: string|null, conversationId?: string|null }} [options]
 */
export async function triggerServerNotificationDelivery(
  client,
  { limit = 5, queueId = null, inquiryId = null, conversationId = null } = {}
) {
  if (!client) {
    return { ok: false, skipped: true };
  }

  if (typeof window === "undefined") {
    const { triggerNotificationDeliveryWithPush } = await import("./deliverNotificationsServer");
    const { deliverNewInquiryNotificationForInquiry } = await import("./deliverNewInquiryForInquiry");
    const { deliverNotificationQueueItemWithPush } = await import("./deliverNotificationsServer");

    if (queueId) {
      return deliverNotificationQueueItemWithPush(client, queueId);
    }

    if (inquiryId || conversationId) {
      return deliverNewInquiryNotificationForInquiry(client, { inquiryId, conversationId });
    }

    return triggerNotificationDeliveryWithPush(client, { limit });
  }

  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token ?? null;
  if (!token) {
    return { ok: false, skipped: true, reason: "not_authenticated" };
  }

  try {
    const response = await fetch("/api/notifications/trigger-delivery", {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit, queueId, inquiryId, conversationId }),
    });
    return response.json().catch(() => ({ ok: false, error: "delivery_request_failed" }));
  } catch {
    return { ok: false, error: "delivery_request_failed" };
  }
}
