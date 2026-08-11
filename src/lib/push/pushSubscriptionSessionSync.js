import { BL_ENABLE_NOTIFICATIONS } from "@/lib/featureFlags";
import { reconcileDevicePushAfterPermissionRestore } from "./pushSubscriptionClient";
import { revokePushSubscription } from "./pushSubscriptionMutations";
import { clearStoredPushDevice, readStoredPushDevice } from "./pushSubscriptionStorage";

/**
 * After authenticated session establishment, bind an existing browser push
 * subscription to the current user without re-prompting for permission.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient,
 *   userId: string,
 * }} params
 */
export async function syncPushSubscriptionForAuthenticatedUser({ client, userId }) {
  if (!BL_ENABLE_NOTIFICATIONS || !client || !userId) {
    return { ok: true, skipped: true, reason: "disabled_or_unauthenticated" };
  }

  if (typeof window === "undefined") {
    return { ok: true, skipped: true, reason: "server_context" };
  }

  return reconcileDevicePushAfterPermissionRestore({ client, userId });
}

/**
 * On logout, revoke backend ownership for this device subscription while
 * preserving browser permission and the PushManager subscription object.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient,
 *   userId: string,
 * }} params
 */
export async function detachPushSubscriptionOnLogout({ client, userId }) {
  if (!client || !userId) {
    return { ok: true, skipped: true, reason: "missing_context" };
  }

  const stored = readStoredPushDevice(userId);
  if (stored.subscriptionId) {
    await revokePushSubscription(client, stored.subscriptionId);
  }

  clearStoredPushDevice(userId);

  return { ok: true, detached: Boolean(stored.subscriptionId) };
}
