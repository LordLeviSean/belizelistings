import { isCrmUnavailable } from "../crm/crmCompat";

const RPC_DELIVER = "deliver_notification";
const RPC_BATCH = "process_notification_queue_batch";

function isDeliveryUnavailable(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return (
    isCrmUnavailable(error) ||
    msg.includes("deliver_notification") ||
    msg.includes("process_notification_queue_batch") ||
    msg.includes("notifications") && msg.includes("does not exist")
  );
}

/**
 * Deliver a single queue item via SECURITY DEFINER RPC.
 * Email channel is stubbed server-side (marked skipped when no provider configured).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} queueId
 */
export async function deliverNotificationQueueItem(client, queueId) {
  if (!client?.rpc || !queueId) {
    return { ok: false, skipped: true };
  }

  const { data, error } = await client.rpc(RPC_DELIVER, { p_queue_id: queueId });

  if (error) {
    if (isDeliveryUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    if (typeof console !== "undefined") {
      console.warn("[notifications] deliver failed", { queueId, message: error.message });
    }
    return { ok: false, error };
  }

  const emailSkipped = !process.env.RESEND_API_KEY;
  return {
    ok: Boolean(data?.ok),
    skipped: Boolean(data?.skipped),
    data: {
      ...data,
      email_channel: emailSkipped ? "skipped" : "pending",
    },
  };
}

/**
 * Process a batch of pending notification_queue rows.
 * Intended for service-role clients (API route / cron / scripts).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ limit?: number }} [options]
 */
export async function processNotificationQueueBatch(client, { limit = 50 } = {}) {
  if (!client?.rpc) {
    return { ok: false, skipped: true };
  }

  const { data, error } = await client.rpc(RPC_BATCH, { p_limit: limit });

  if (error) {
    if (isDeliveryUnavailable(error)) {
      return { ok: true, skipped: true, error };
    }
    return { ok: false, error };
  }

  return { ok: true, data };
}

/**
 * Best-effort deliver after enqueue — non-blocking for mutation callers.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string|null|undefined} queueId
 */
export async function deliverAfterEnqueue(client, queueId) {
  if (!queueId) return { ok: true, skipped: true };
  try {
    return await deliverNotificationQueueItem(client, queueId);
  } catch (e) {
    if (typeof console !== "undefined") {
      console.warn("[notifications] deliverAfterEnqueue", e?.message || e);
    }
    return { ok: false, error: e };
  }
}
