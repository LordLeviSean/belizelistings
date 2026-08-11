import { BL_ENABLE_NOTIFICATIONS } from "@/lib/featureFlags";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/notificationEvents";
import { resolveAgentRepliedNotificationHref } from "@/lib/notifications/agentRepliedNotificationRouting";
import { resolveAdminRepliedNotificationHref } from "@/lib/notifications/adminRepliedNotificationRouting";
import { resolveBuyerRepliedNotificationHref } from "@/lib/notifications/buyerRepliedNotificationRouting";
import { resolveNewInquiryNotificationHref } from "@/lib/notifications/newInquiryNotificationRouting";
import { buildAgentRepliedPushPayload } from "./buildAgentRepliedPushPayload";
import {
  buildAdminRepliedPushPayload,
  buildBuyerRepliedPushPayload,
} from "./buildMessagingPushPayload";
import {
  buildNewInquiryPushPayload,
  resolveNewInquiryPushDestination,
} from "./buildNewInquiryPushPayload";
import {
  buildViewingRequestedPushPayload,
  resolveViewingRequestedPushDestination,
} from "./buildViewingRequestedPushPayload";
import {
  buildViewingConfirmedPushPayload,
  resolveViewingConfirmedPushDestination,
} from "./buildViewingConfirmedPushPayload";
import { sendWebPushToUser } from "./sendWebPushToUser";
import {
  WEB_PUSH_DELIVERY_STATUS,
  claimWebPushDeliveryAttempt,
  readWebPushDeliveryState,
  isWebPushDeliveryRetryable,
  isStaleInProgress,
  recordWebPushDeliveryOutcome,
} from "./webPushDeliveryState";

const WEB_PUSH_DELIVERED_KEY = "_web_push_delivered";

/** Event types wired to immediate + recovery Web Push delivery. */
export const CONNECTED_PUSH_EVENT_TYPES = Object.freeze([
  "new_inquiry",
  "buyer_replied",
  "agent_replied",
  "admin_replied",
  "viewing_requested",
  "viewing_confirmed",
]);

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} notificationId
 */
export async function markNotificationWebPushDelivered(adminClient, notificationId) {
  return recordWebPushDeliveryOutcome(adminClient, notificationId, {
    status: WEB_PUSH_DELIVERY_STATUS.DELIVERED,
    deliveredCount: 1,
  });
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

  const state = readWebPushDeliveryState(payload);
  return (
    state.status === WEB_PUSH_DELIVERY_STATUS.DELIVERED ||
    payload[WEB_PUSH_DELIVERED_KEY] === true
  );
}

/**
 * @deprecated Pre-claim blocked legitimate retries. Use claimWebPushDeliveryAttempt.
 */
export async function claimNotificationWebPushDelivery(adminClient, notificationId) {
  const claim = await claimWebPushDeliveryAttempt(adminClient, notificationId);
  return claim.claimed;
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
 * @param {object} pushResult
 */
function resolvePushDeliveryStatus(pushResult) {
  if (!pushResult) {
    return {
      status: WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE,
      reason: "push_send_failed",
    };
  }

  if (Number(pushResult.delivered) > 0) {
    return {
      status: WEB_PUSH_DELIVERY_STATUS.DELIVERED,
      reason: null,
      deliveredCount: pushResult.delivered,
    };
  }

  if (pushResult.error === "no_active_subscriptions") {
    return {
      status: WEB_PUSH_DELIVERY_STATUS.NO_SUBSCRIPTION,
      reason: pushResult.error,
    };
  }

  if (Number(pushResult.temporaryFailures) > 0) {
    return {
      status: WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE,
      reason: pushResult.error || "temporary_failure",
    };
  }

  return {
    status: WEB_PUSH_DELIVERY_STATUS.FAILED,
    reason: pushResult.error || "push_failed",
  };
}

function isConnectedPushEventType(eventType) {
  return CONNECTED_PUSH_EVENT_TYPES.includes(eventType);
}

function buildPushPayloadForEvent(eventType, { notificationId, dedupeKey, href, payload = {} }) {
  if (eventType === NOTIFICATION_EVENT_TYPES.AGENT_REPLIED) {
    return buildAgentRepliedPushPayload({ notificationId, dedupeKey, href, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.BUYER_REPLIED) {
    return buildBuyerRepliedPushPayload({ notificationId, dedupeKey, href, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED) {
    return buildAdminRepliedPushPayload({ notificationId, dedupeKey, href, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED) {
    return buildViewingRequestedPushPayload({ notificationId, dedupeKey, href, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED) {
    return buildViewingConfirmedPushPayload({ notificationId, dedupeKey, href, payload });
  }
  return buildNewInquiryPushPayload({ notificationId, dedupeKey, href, payload });
}

function resolvePushHrefForEvent(eventType, recipientRole, payload) {
  if (eventType === NOTIFICATION_EVENT_TYPES.AGENT_REPLIED) {
    return resolveAgentRepliedNotificationHref({ recipientRole, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.BUYER_REPLIED) {
    return resolveBuyerRepliedNotificationHref({ recipientRole, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.ADMIN_REPLIED) {
    return resolveAdminRepliedNotificationHref({ recipientRole, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.VIEWING_REQUESTED) {
    return resolveViewingRequestedPushDestination({ recipientRole, payload });
  }
  if (eventType === NOTIFICATION_EVENT_TYPES.VIEWING_CONFIRMED) {
    return resolveViewingConfirmedPushDestination({ recipientRole, payload });
  }
  return resolveNewInquiryNotificationHref({ recipientRole, payload });
}

/**
 * Attempt Web Push for a delivered inquiry notification (new_inquiry or agent_replied).
 * Uses server-side recipient identity from deliver_notification results only.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object} deliverResult
 * @param {{ source?: string }} [options]
 */
export async function deliverNewInquiryWebPush(adminClient, deliverResult, { source = "immediate" } = {}) {
  if (!BL_ENABLE_NOTIFICATIONS || !adminClient) {
    return { ok: true, skipped: true, reason: "notifications_disabled", source };
  }

  if (!deliverResult?.ok || deliverResult.skipped) {
    return { ok: true, skipped: true, reason: "delivery_skipped", source };
  }

  const eventType = deliverResult.event_type ?? deliverResult.eventType;
  if (!isConnectedPushEventType(eventType)) {
    return { ok: true, skipped: true, reason: "unsupported_event", source };
  }

  const recipientId = deliverResult.recipient_id ?? deliverResult.recipientId;
  const notificationId = deliverResult.notification_id ?? deliverResult.notificationId;
  const dedupeKey = deliverResult.dedupe_key ?? deliverResult.dedupeKey ?? null;

  if (!recipientId || !notificationId) {
    return { ok: true, skipped: true, reason: "missing_delivery_identity", source };
  }

  const claim = await claimWebPushDeliveryAttempt(adminClient, notificationId);
  if (!claim.claimed) {
    return { ok: true, skipped: true, reason: claim.reason, source };
  }

  const { data: notification, error: notificationError } = await adminClient
    .from("notifications")
    .select("payload")
    .eq("id", notificationId)
    .eq("recipient_user_id", recipientId)
    .maybeSingle();

  if (notificationError || !notification) {
    await recordWebPushDeliveryOutcome(adminClient, notificationId, {
      status: WEB_PUSH_DELIVERY_STATUS.FAILED,
      reason: "notification_not_found",
    });
    return { ok: true, skipped: true, reason: "notification_not_found", source };
  }

  const payload =
    notification.payload && typeof notification.payload === "object" && !Array.isArray(notification.payload)
      ? notification.payload
      : {};

  const recipientRole = await resolveTrustedRecipientRole(adminClient, recipientId);
  const href = resolvePushHrefForEvent(eventType, recipientRole, payload);
  const built = buildPushPayloadForEvent(eventType, {
    notificationId,
    dedupeKey,
    href,
    payload,
  });

  if (!built.ok) {
    await recordWebPushDeliveryOutcome(adminClient, notificationId, {
      status: WEB_PUSH_DELIVERY_STATUS.FAILED,
      reason: built.error || "invalid_push_payload",
    });
    return { ok: true, skipped: true, reason: built.error || "invalid_push_payload", source };
  }

  try {
    const pushResult = await sendWebPushToUser(adminClient, recipientId, built, { maxSubscriptions: 1 });
    const outcome = resolvePushDeliveryStatus(pushResult);
    await recordWebPushDeliveryOutcome(adminClient, notificationId, outcome);

    return {
      ok: true,
      skipped: false,
      push: pushResult,
      deliveryStatus: outcome.status,
      reason: outcome.reason,
      source,
    };
  } catch {
    await recordWebPushDeliveryOutcome(adminClient, notificationId, {
      status: WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE,
      reason: "push_send_failed",
    });
    return { ok: true, skipped: false, reason: "push_send_failed", source };
  }
}

/**
 * Retry push for delivered inquiry rows that never reached a device.
 * Recovery-only: skips terminal outcomes and in-progress claims.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {{ hours?: number, limit?: number }} [options]
 */
export async function reconcileUndeliveredNewInquiryPushes(adminClient, { hours = 2, limit = 20 } = {}) {
  if (!BL_ENABLE_NOTIFICATIONS || !adminClient?.from) {
    return { ok: true, attempted: 0, delivered: 0, skipped: 0, source: "reconciliation" };
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await adminClient
    .from("notifications")
    .select("id,recipient_user_id,event_type,dedupe_key,payload,created_at")
    .in("event_type", [...CONNECTED_PUSH_EVENT_TYPES])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, limit));

  if (error || !rows?.length) {
    return { ok: true, attempted: 0, delivered: 0, skipped: 0, source: "reconciliation" };
  }

  let attempted = 0;
  let delivered = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
    const state = readWebPushDeliveryState(payload);

    if (!isWebPushDeliveryRetryable(state.status)) {
      skipped += 1;
      continue;
    }

    if (
      state.status === WEB_PUSH_DELIVERY_STATUS.IN_PROGRESS &&
      !isStaleInProgress(state.status, state.attempted_at)
    ) {
      skipped += 1;
      continue;
    }

    attempted += 1;
    const outcome = await deliverNewInquiryWebPush(
      adminClient,
      {
        ok: true,
        event_type: row.event_type,
        recipient_id: row.recipient_user_id,
        notification_id: row.id,
        dedupe_key: row.dedupe_key,
      },
      { source: "reconciliation" }
    );

    if (outcome.deliveryStatus === WEB_PUSH_DELIVERY_STATUS.DELIVERED || outcome.push?.delivered > 0) {
      delivered += 1;
    }
  }

  return { ok: true, attempted, delivered, skipped, source: "reconciliation" };
}

/**
 * Best-effort push hook for notification delivery results. Never throws.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {object|null|undefined} deliverResult
 * @param {{ source?: string }} [options]
 */
export async function maybeDeliverNewInquiryWebPush(adminClient, deliverResult, options = {}) {
  try {
    return await deliverNewInquiryWebPush(adminClient, deliverResult, options);
  } catch {
    return { ok: true, skipped: true, reason: "push_hook_failed", source: options.source || "immediate" };
  }
}

// Re-export shared routing for backwards compatibility in tests.
export { resolveNewInquiryPushDestination };

