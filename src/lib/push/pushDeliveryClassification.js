/**
 * Web Push delivery outcome classification for later send/retry logic.
 * Pure utilities — no network I/O in Step 5A.
 */

export const PUSH_DELIVERY_OUTCOMES = Object.freeze({
  SUCCESS: "success",
  EXPIRED_SUBSCRIPTION: "expired_subscription",
  INVALID_SUBSCRIPTION: "invalid_subscription",
  VAPID_CONFIG_ERROR: "vapid_config_error",
  TEMPORARY_SERVICE_FAILURE: "temporary_service_failure",
  RATE_LIMITED: "rate_limited",
  UNEXPECTED_ERROR: "unexpected_error",
});

/**
 * @typedef {typeof PUSH_DELIVERY_OUTCOMES[keyof typeof PUSH_DELIVERY_OUTCOMES]} PushDeliveryOutcome
 */

/**
 * Classify an HTTP status from a push service response.
 * Standards-based endpoints may be FCM (Android/desktop), Apple (iOS Web Push), etc.
 * @param {number|null|undefined} statusCode
 */
export function classifyPushHttpStatus(statusCode) {
  const status = Number(statusCode);
  if (!Number.isFinite(status)) {
    return {
      outcome: PUSH_DELIVERY_OUTCOMES.UNEXPECTED_ERROR,
      deactivateSubscription: false,
      retryEligible: false,
    };
  }

  if (status >= 200 && status < 300) {
    return {
      outcome: PUSH_DELIVERY_OUTCOMES.SUCCESS,
      deactivateSubscription: false,
      retryEligible: false,
    };
  }

  if (status === 404 || status === 410) {
    return {
      outcome: PUSH_DELIVERY_OUTCOMES.EXPIRED_SUBSCRIPTION,
      deactivateSubscription: true,
      retryEligible: false,
    };
  }

  if (status === 400 || status === 401 || status === 403) {
    return {
      outcome:
        status === 401 || status === 403
          ? PUSH_DELIVERY_OUTCOMES.VAPID_CONFIG_ERROR
          : PUSH_DELIVERY_OUTCOMES.INVALID_SUBSCRIPTION,
      deactivateSubscription: status === 400,
      retryEligible: false,
    };
  }

  if (status === 429) {
    return {
      outcome: PUSH_DELIVERY_OUTCOMES.RATE_LIMITED,
      deactivateSubscription: false,
      retryEligible: true,
    };
  }

  if (status >= 500) {
    return {
      outcome: PUSH_DELIVERY_OUTCOMES.TEMPORARY_SERVICE_FAILURE,
      deactivateSubscription: false,
      retryEligible: true,
    };
  }

  return {
    outcome: PUSH_DELIVERY_OUTCOMES.UNEXPECTED_ERROR,
    deactivateSubscription: false,
    retryEligible: false,
  };
}

/**
 * Map classified outcome to subscription delivery record RPC outcome.
 * @param {PushDeliveryOutcome} outcome
 */
export function mapOutcomeToSubscriptionRecord(outcome) {
  if (outcome === PUSH_DELIVERY_OUTCOMES.SUCCESS) return "success";
  if (
    outcome === PUSH_DELIVERY_OUTCOMES.TEMPORARY_SERVICE_FAILURE ||
    outcome === PUSH_DELIVERY_OUTCOMES.RATE_LIMITED
  ) {
    return "temporary_failure";
  }
  return null;
}

/**
 * Whether a failed delivery should deactivate only the affected subscription.
 * @param {PushDeliveryOutcome} outcome
 */
export function shouldDeactivateSubscription(outcome) {
  return (
    outcome === PUSH_DELIVERY_OUTCOMES.EXPIRED_SUBSCRIPTION ||
    outcome === PUSH_DELIVERY_OUTCOMES.INVALID_SUBSCRIPTION
  );
}

/**
 * Documented multi-device isolation — one failed endpoint must not revoke others.
 */
export function isolateFailedSubscription({ userSubscriptionCount, failedSubscriptionId }) {
  return {
    failedSubscriptionId,
    remainingActiveSubscriptions: Math.max(0, Number(userSubscriptionCount || 0) - 1),
    otherDevicesUnaffected: Number(userSubscriptionCount || 0) > 1,
  };
}
