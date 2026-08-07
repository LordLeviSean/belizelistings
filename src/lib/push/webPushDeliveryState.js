export const WEB_PUSH_STATE_KEY = "_web_push";

/** @typedef {'not_attempted'|'in_progress'|'delivered'|'no_subscription'|'temporary_failure'|'failed'} WebPushDeliveryStatus */

export const WEB_PUSH_DELIVERY_STATUS = Object.freeze({
  NOT_ATTEMPTED: "not_attempted",
  IN_PROGRESS: "in_progress",
  DELIVERED: "delivered",
  NO_SUBSCRIPTION: "no_subscription",
  TEMPORARY_FAILURE: "temporary_failure",
  FAILED: "failed",
});

const STALE_IN_PROGRESS_MS = 5 * 60 * 1000;

/**
 * @param {object|null|undefined} payload
 */
export function readWebPushDeliveryState(payload) {
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const state =
    root[WEB_PUSH_STATE_KEY] && typeof root[WEB_PUSH_STATE_KEY] === "object"
      ? root[WEB_PUSH_STATE_KEY]
      : {};

  if (root._web_push_delivered === true && !state.status) {
    return {
      status: WEB_PUSH_DELIVERY_STATUS.DELIVERED,
      attempted_at: null,
      delivered_at: null,
      delivered_count: 1,
      last_reason: null,
    };
  }

  return {
    status: state.status || WEB_PUSH_DELIVERY_STATUS.NOT_ATTEMPTED,
    attempted_at: state.attempted_at ?? null,
    delivered_at: state.delivered_at ?? null,
    delivered_count: Number(state.delivered_count) || 0,
    last_reason: state.last_reason ?? null,
  };
}

/**
 * @param {WebPushDeliveryStatus} status
 */
export function isWebPushDeliveryTerminal(status) {
  return (
    status === WEB_PUSH_DELIVERY_STATUS.DELIVERED ||
    status === WEB_PUSH_DELIVERY_STATUS.NO_SUBSCRIPTION ||
    status === WEB_PUSH_DELIVERY_STATUS.FAILED
  );
}

/**
 * @param {WebPushDeliveryStatus} status
 */
export function isWebPushDeliveryRetryable(status) {
  return (
    status === WEB_PUSH_DELIVERY_STATUS.NOT_ATTEMPTED ||
    status === WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE
  );
}

/**
 * @param {WebPushDeliveryStatus} status
 * @param {string|null|undefined} attemptedAt
 */
export function isStaleInProgress(status, attemptedAt) {
  if (status !== WEB_PUSH_DELIVERY_STATUS.IN_PROGRESS || !attemptedAt) {
    return false;
  }
  const ts = Date.parse(attemptedAt);
  if (Number.isNaN(ts)) {
    return true;
  }
  return Date.now() - ts > STALE_IN_PROGRESS_MS;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} notificationId
 */
export async function claimWebPushDeliveryAttempt(adminClient, notificationId) {
  if (!adminClient?.from || !notificationId) {
    return { claimed: false, reason: "invalid_arguments" };
  }

  const { data: existing, error: readError } = await adminClient
    .from("notifications")
    .select("id,payload")
    .eq("id", notificationId)
    .maybeSingle();

  if (readError || !existing?.id) {
    return { claimed: false, reason: "notification_not_found" };
  }

  const payload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};

  const current = readWebPushDeliveryState(payload);

  if (current.status === WEB_PUSH_DELIVERY_STATUS.DELIVERED) {
    return { claimed: false, reason: "already_delivered" };
  }

  if (
    current.status === WEB_PUSH_DELIVERY_STATUS.IN_PROGRESS &&
    !isStaleInProgress(current.status, current.attempted_at)
  ) {
    return { claimed: false, reason: "in_progress" };
  }

  if (isWebPushDeliveryTerminal(current.status) && current.status !== WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE) {
    if (current.status === WEB_PUSH_DELIVERY_STATUS.NO_SUBSCRIPTION) {
      return { claimed: false, reason: "no_subscription" };
    }
    return { claimed: false, reason: current.status };
  }

  const attemptedAt = new Date().toISOString();
  const nextPayload = {
    ...payload,
    [WEB_PUSH_STATE_KEY]: {
      ...current,
      status: WEB_PUSH_DELIVERY_STATUS.IN_PROGRESS,
      attempted_at: attemptedAt,
      last_reason: null,
    },
  };

  delete nextPayload._web_push_delivered;

  const { data: updated, error: updateError } = await adminClient
    .from("notifications")
    .update({ payload: nextPayload })
    .eq("id", notificationId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated?.id) {
    return { claimed: false, reason: "claim_failed" };
  }

  return { claimed: true, attemptedAt };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} notificationId
 * @param {{ status: WebPushDeliveryStatus, deliveredCount?: number, reason?: string|null }} outcome
 */
export async function recordWebPushDeliveryOutcome(adminClient, notificationId, outcome) {
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

  const current = readWebPushDeliveryState(payload);
  const now = new Date().toISOString();
  const deliveredCount = Number(outcome.deliveredCount) || 0;

  const nextState = {
    status: outcome.status,
    attempted_at: current.attempted_at || now,
    delivered_at:
      outcome.status === WEB_PUSH_DELIVERY_STATUS.DELIVERED ? now : current.delivered_at,
    delivered_count: Math.max(current.delivered_count, deliveredCount),
    last_reason: outcome.reason ?? null,
  };

  const nextPayload = {
    ...payload,
    [WEB_PUSH_STATE_KEY]: nextState,
  };

  if (outcome.status === WEB_PUSH_DELIVERY_STATUS.DELIVERED) {
    nextPayload._web_push_delivered = true;
  } else {
    delete nextPayload._web_push_delivered;
  }

  const { error } = await adminClient
    .from("notifications")
    .update({ payload: nextPayload })
    .eq("id", notificationId);

  return !error;
}
