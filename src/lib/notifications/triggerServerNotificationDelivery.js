/**
 * Route notification queue processing through the server push pipeline.
 * Browser clients cannot invoke service-role delivery RPCs directly.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ limit?: number }} [options]
 */
export async function triggerServerNotificationDelivery(client, { limit = 5 } = {}) {
  if (!client) {
    return { ok: false, skipped: true };
  }

  if (typeof window === "undefined") {
    const { triggerNotificationDeliveryWithPush } = await import("./deliverNotificationsServer");
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
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit }),
    });
    return response.json().catch(() => ({ ok: false, error: "delivery_request_failed" }));
  } catch {
    return { ok: false, error: "delivery_request_failed" };
  }
}
