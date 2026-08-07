import { registerBelizeListingsServiceWorker } from "@/lib/pwa/registerServiceWorker";
import {
  detectPushPlatformLabel,
  getPushCapability,
  urlBase64ToUint8Array,
} from "./pushSubscriptionSupport";
import {
  listMyPushSubscriptionDevices,
  registerPushSubscription,
  revokePushSubscription,
} from "./pushSubscriptionMutations";
import {
  clearStoredPushDevice,
  readStoredPushDevice,
  writeStoredPushDevice,
} from "./pushSubscriptionStorage";

/**
 * @param {() => Promise<string | null>} getAccessToken
 */
export async function fetchVapidPublicConfig(getAccessToken) {
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, config: null, error: "not_authenticated" };
  }

  const response = await fetch("/api/push/vapid-public", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body?.ok) {
    return {
      ok: false,
      config: null,
      error: body?.error || "vapid_unavailable",
    };
  }

  return {
    ok: true,
    config: {
      publicKey: body.publicKey,
      subject: body.subject,
    },
    error: null,
  };
}

/**
 * @param {PushSubscription} subscription
 */
export function pushSubscriptionToRpcPayload(subscription) {
  const json = subscription.toJSON();
  const keys = json.keys || {};
  return {
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    authSecret: keys.auth,
    expirationTime: json.expirationTime
      ? new Date(json.expirationTime).toISOString()
      : null,
    platformLabel: detectPushPlatformLabel(),
  };
}

/**
 * @param {{ registration: ServiceWorkerRegistration, publicKey: string }} params
 */
export async function createBrowserPushSubscription({ registration, publicKey }) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
export async function loadPushDeviceStatus(client, userId) {
  const capability = getPushCapability();
  const stored = readStoredPushDevice(userId);
  const browserSubscription =
    capability.canSubscribe || capability.permission === "granted"
      ? await getBrowserPushSubscription()
      : null;

  const { ok, devices } = await listMyPushSubscriptionDevices(client);
  const activeDevices = ok ? devices.filter((d) => d.is_active) : [];

  let currentDeviceRegistered = false;
  let currentSubscriptionId = stored.subscriptionId;

  if (currentSubscriptionId) {
    currentDeviceRegistered = activeDevices.some(
      (d) => d.subscription_id === currentSubscriptionId
    );
  }

  if (browserSubscription && !currentDeviceRegistered && activeDevices.length > 0) {
    // Browser still holds a subscription but local id is stale — treat as off until re-enabled.
    currentSubscriptionId = null;
  }

  if (!browserSubscription) {
    currentDeviceRegistered = false;
    if (stored.subscriptionId) {
      clearStoredPushDevice(userId);
    }
  }

  return {
    capability,
    browserSubscription: Boolean(browserSubscription),
    currentDeviceRegistered,
    currentSubscriptionId,
    activeDevices,
  };
}

async function getBrowserPushSubscription() {
  const sw = registerBelizeListingsServiceWorker();
  if (!sw.registered || !sw.registrationPromise) return null;

  const settled = await sw.registrationPromise;
  if (!settled.registered) return null;

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav?.serviceWorker) return null;

  const registration = await nav.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient,
 *   userId: string,
 *   getAccessToken: () => Promise<string | null>,
 * }} params
 */
export async function enableDevicePushNotifications({ client, userId, getAccessToken }) {
  const capability = getPushCapability();
  if (!capability.canSubscribe) {
    return { ok: false, error: capability.capability };
  }

  const permission = await (typeof Notification !== "undefined"
    ? Notification.requestPermission()
    : Promise.resolve("denied"));
  if (permission !== "granted") {
    return { ok: false, error: permission === "denied" ? "denied" : "permission_not_granted" };
  }

  const vapid = await fetchVapidPublicConfig(getAccessToken);
  if (!vapid.ok || !vapid.config?.publicKey) {
    return { ok: false, error: vapid.error || "vapid_unavailable" };
  }

  const sw = registerBelizeListingsServiceWorker();
  if (!sw.registered || !sw.registrationPromise) {
    return { ok: false, error: "service_worker_unavailable" };
  }

  const settled = await sw.registrationPromise;
  if (!settled.registered) {
    return { ok: false, error: "service_worker_unavailable" };
  }

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav?.serviceWorker) {
    return { ok: false, error: "service_worker_unavailable" };
  }

  const registration = await nav.serviceWorker.ready;
  const subscription = await createBrowserPushSubscription({
    registration,
    publicKey: vapid.config.publicKey,
  });

  const payload = pushSubscriptionToRpcPayload(subscription);
  const result = await registerPushSubscription(client, payload);

  if (!result.ok || !result.subscriptionId) {
    return { ok: false, error: result.error?.message || "register_failed" };
  }

  writeStoredPushDevice(userId, result.subscriptionId);

  return {
    ok: true,
    subscriptionId: result.subscriptionId,
    error: null,
  };
}

/**
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient,
 *   userId: string,
 *   subscriptionId?: string | null,
 * }} params
 */
export async function disableDevicePushNotifications({ client, userId, subscriptionId }) {
  const stored = readStoredPushDevice(userId);
  const targetId = subscriptionId || stored.subscriptionId;

  if (targetId) {
    await revokePushSubscription(client, targetId);
  }

  try {
    const subscription = await getBrowserPushSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch {
    // Unsubscribe failures should not block server revoke.
  }

  clearStoredPushDevice(userId);

  return { ok: true };
}
