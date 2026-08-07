/**
 * Client-side RPC wrappers for push subscription lifecycle.
 * Endpoints and keys never leave the browser except to register_push_subscription.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listMyPushSubscriptionDevices(client) {
  const { data, error } = await client.rpc("list_my_push_subscription_devices");
  if (error) {
    return { ok: false, devices: [], error };
  }
  return { ok: true, devices: Array.isArray(data) ? data : [], error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   endpoint: string,
 *   p256dh: string,
 *   authSecret: string,
 *   expirationTime?: string | null,
 *   platformLabel?: string | null,
 * }} payload
 */
export async function registerPushSubscription(client, payload) {
  const { data, error } = await client.rpc("register_push_subscription", {
    p_endpoint: payload.endpoint,
    p_p256dh: payload.p256dh,
    p_auth_secret: payload.authSecret,
    p_expiration_time: payload.expirationTime ?? null,
    p_platform_label: payload.platformLabel ?? null,
  });

  if (error) {
    return { ok: false, error, subscriptionId: null };
  }

  if (!data?.ok) {
    return {
      ok: false,
      error: new Error(data?.error || "register_failed"),
      subscriptionId: null,
    };
  }

  return {
    ok: true,
    subscriptionId: data.subscription_id ?? null,
    error: null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} subscriptionId
 */
export async function revokePushSubscription(client, subscriptionId) {
  const { data, error } = await client.rpc("revoke_push_subscription", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    return { ok: false, error };
  }

  if (!data?.ok) {
    return {
      ok: false,
      error: new Error(data?.error || "revoke_failed"),
    };
  }

  return { ok: true, error: null };
}
