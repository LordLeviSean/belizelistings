/**
 * Documented integration point for later Web Push delivery (Step 5B+).
 *
 * Intended pipeline:
 * 1. Application event → enqueue_notification_event → notification_queue
 * 2. deliver_notification → durable notifications inbox (authoritative)
 * 3. Push delivery layer (future) loads active subscriptions via
 *    select_active_push_subscriptions_for_delivery(recipient_id)
 * 4. buildPushPayload() from notification row + presentation href
 * 5. Encrypt/send per subscription; classifyPushHttpStatus() per response
 * 6. deactivate_push_subscription() only for permanent endpoint failures
 * 7. record_push_subscription_delivery() for success/temporary failure counters
 *
 * Step 5D connects Web Push for `new_inquiry` only, after deliver_notification
 * succeeds. In-app notifications remain authoritative; push failures are non-blocking.
 */

export const PUSH_DELIVERY_INTEGRATION = Object.freeze({
  IN_APP_AUTHORITY: "notifications",
  QUEUE_RPC: "deliver_notification",
  BATCH_RPC: "process_notification_queue_batch",
  CONNECTED_EVENT_TYPES: Object.freeze(["new_inquiry"]),
  SUBSCRIPTION_SELECT_RPC: "select_active_push_subscriptions_for_delivery",
  SUBSCRIPTION_REGISTER_RPC: "register_push_subscription",
  SUBSCRIPTION_REVOKE_RPC: "revoke_push_subscription",
  SUBSCRIPTION_DEACTIVATE_RPC: "deactivate_push_subscription",
  SUBSCRIPTION_RECORD_RPC: "record_push_subscription_delivery",
});

/**
 * Logout policy (documented for Step 5B+) — not implemented in 5A.
 *
 * Recommendation: preserve subscription across logout/login on the same device.
 * Browser notification permission remains device-local; logout should not
 * imply permission revocation. Users disable push per-device via explicit revoke.
 * Optional future step: deactivate current-device subscription on logout when the
 * client can identify the active subscription id.
 */
export const PUSH_LOGOUT_POLICY = Object.freeze({
  IMPLEMENTED: false,
  RECOMMENDATION: "preserve_subscription_across_logout",
  REQUIRES_EXPLICIT_REVOKE: true,
});

/**
 * Cross-platform compatibility model — standards-based Web Push only.
 */
export const PUSH_PLATFORM_MODEL = Object.freeze({
  IOS_REQUIRES_HOME_SCREEN_INSTALL: true,
  USES_BROWSER_PUSH_SUBSCRIPTION: true,
  NO_FCM_APP_INTEGRATION: true,
  NO_APNS_CREDENTIALS_IN_APP: true,
  ENDPOINTS_ARE_BROWSER_PROVIDED: true,
  MULTI_DEVICE_PER_USER: true,
});
