import { BL_ENABLE_NOTIFICATIONS } from "@/lib/featureFlags";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import {
  buildNewInquiryPushPayload,
  resolveNewInquiryPushDestination,
} from "./buildNewInquiryPushPayload";
import { sendWebPushToUser } from "./sendWebPushToUser";

const WEB_PUSH_DELIVERED_KEY = "_web_push_delivered";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} notificationId
 */
export async function markNotificationWebPushDelivered(adminClient, notificationId) {
  if (!adminClient?.from || !notificationId) {
    return false;
  }

  const { data: existing, error: readError } = await adminClient
    .from("notifications")
    .select("id, payload")
    .eq("id", notificationId)
    .maybeSingle();

  if (readError || !existing?.id) {
    return false;
  }

  const payload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};

  if (payload[WEB_PUSH_DELIVERED_KEY] === true) {
    return true;
  }

  const { data: updated, error: updateError } = await adminClient
    .from("notifications")
    .update({
      payload: {
        ...payload,
        [WEB_PUSH_DELIVERED_KEY]: true,
      },
    })
    .eq("id", notificationId)
    .select("id")
    .maybeSingle();

  return Boolean(updated?.id && !updateError);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} notificationId
 */
export async function hasNotificationWebPushDelivered(adminClient, notificationId) {
  if (!adminClient?.from || !notificationId) {
    return false;
  }

  const { data: existing } = await adminClient
    .from("notifications")
    .select("payload")
    .eq("id", notificationId)
    .maybeSingle();

  const payload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};

  return payload[WEB_PUSH_DELIVERED_KEY] === true;
}

/**
 * @deprecated Pre-claim blocked legitimate retries. Use markNotificationWebPushDelivered after success.
 */
export async function claimNotificationWebPushDelivery(adminClient, notificationId) {
  const already = await hasNotificationWebPushDelivered(adminClient, notificationId);
  return !already;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} recipientId
 */
export async function resolveTrustedRecipientRole(adminClient, recipientId) {
  if (!adminClient?.from || !recipientId) {
    return "user";
  }

  const { data } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", recipientId)
    .maybeSingle();

  const role = String(data?.role || "user").trim().toLowerCase();
  if (role === "admin" || role === "agent") {
    return role;
  }
  return "user";
}

/**
 * Attempt Web Push for a delivered new_inquiry notification.
 * Uses server-side recipient identity from deliver_notification results only.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object} deliverResult
 */
export async function deliverNewInquiryWebPush(adminClient, deliverResult) {
  if (!BL_ENABLE_NOTIFICATIONS || !adminClient) {
    return { ok: true, skipped: true, reason: "notifications_disabled" };
  }

  if (!deliverResult?.ok || deliverResult.skipped) {
    return { ok: true, skipped: true, reason: "delivery_skipped" };
  }

  const eventType = deliverResult.event_type ?? deliverResult.eventType;
  if (eventType !== NOTIFICATION_EVENT_TYPES.NEW_INQUIRY) {
    return { ok: true, skipped: true, reason: "unsupported_event" };
  }

  const recipientId = deliverResult.recipient_id ?? deliverResult.recipientId;
  const notificationId = deliverResult.notification_id ?? deliverResult.notificationId;
  const dedupeKey = deliverResult.dedupe_key ?? deliverResult.dedupeKey ?? null;

  if (!recipientId || !notificationId) {
    return { ok: true, skipped: true, reason: "missing_delivery_identity" };
  }

  if (await hasNotificationWebPushDelivered(adminClient, notificationId)) {
    return { ok: true, skipped: true, reason: "already_delivered" };
  }

  const { data: notification, error: notificationError } = await adminClient
    .from("notifications")
    .select("payload")
    .eq("id", notificationId)
    .eq("recipient_user_id", recipientId)
    .maybeSingle();

  if (notificationError || !notification) {
    return { ok: true, skipped: true, reason: "notification_not_found" };
  }

  const payload =
    notification.payload && typeof notification.payload === "object" && !Array.isArray(notification.payload)
      ? notification.payload
      : {};

  const recipientRole = await resolveTrustedRecipientRole(adminClient, recipientId);
  const href = resolveNewInquiryPushDestination({ recipientRole, payload });
  const built = buildNewInquiryPushPayload({
    notificationId,
    dedupeKey,
    href,
  });

  if (!built.ok) {
    return { ok: true, skipped: true, reason: built.error || "invalid_push_payload" };
  }

  try {
    const result = await sendWebPushToUser(adminClient, recipientId, built);
    if (result.delivered > 0) {
      await markNotificationWebPushDelivered(adminClient, notificationId);
    }
    return {
      ok: true,
      skipped: false,
      push: result,
      reason: result.error || null,
    };
  } catch {
    return { ok: true, skipped: false, reason: "push_send_failed" };
  }
}

/**
 * Retry push for delivered in-app new_inquiry rows that never reached a device.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {{ hours?: number, limit?: number }} [options]
 */
export async function reconcileUndeliveredNewInquiryPushes(adminClient, { hours = 48, limit = 20 } = {}) {
  if (!BL_ENABLE_NOTIFICATIONS || !adminClient?.from) {
    return { ok: true, attempted: 0, delivered: 0 };
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await adminClient
    .from("notifications")
    .select("id,recipient_user_id,event_type,dedupe_key,payload,created_at")
    .eq("event_type", NOTIFICATION_EVENT_TYPES.NEW_INQUIRY)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, limit));

  if (error || !rows?.length) {
    return { ok: true, attempted: 0, delivered: 0 };
  }

  let attempted = 0;
  let delivered = 0;

  for (const row of rows) {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
    if (payload[WEB_PUSH_DELIVERED_KEY] === true) {
      continue;
    }

    attempted += 1;
    const outcome = await deliverNewInquiryWebPush(adminClient, {
      ok: true,
      event_type: NOTIFICATION_EVENT_TYPES.NEW_INQUIRY,
      recipient_id: row.recipient_user_id,
      notification_id: row.id,
      dedupe_key: row.dedupe_key,
    });

    if (outcome.push?.delivered > 0) {
      delivered += 1;
    }
  }

  return { ok: true, attempted, delivered };
}

/**
 * Best-effort push hook for notification delivery results. Never throws.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object|null|undefined} deliverResult
 */
export async function maybeDeliverNewInquiryWebPush(adminClient, deliverResult) {
  try {
    return await deliverNewInquiryWebPush(adminClient, deliverResult);
  } catch {
    return { ok: true, skipped: true, reason: "push_hook_failed" };
  }
}
