import {
  detectIosDevice,
  detectStandaloneDisplayMode,
} from "@/lib/pwa/installationState";

/** @typedef {'unsupported' | 'ios-not-installed' | 'ios-installed' | 'default' | 'denied' | 'granted'} PushPermissionState */

export const PUSH_CAPABILITY = Object.freeze({
  UNSUPPORTED: "unsupported",
  IOS_NOT_INSTALLED: "ios-not-installed",
  IOS_INSTALLED: "ios-installed",
  PERMISSION_DEFAULT: "default",
  PERMISSION_DENIED: "denied",
  PERMISSION_GRANTED: "granted",
});

function envWindow(env) {
  if (Object.prototype.hasOwnProperty.call(env, "window")) {
    return env.window || undefined;
  }
  return typeof window !== "undefined" ? window : undefined;
}

function envNavigator(env) {
  if (Object.prototype.hasOwnProperty.call(env, "navigator")) {
    return env.navigator || undefined;
  }
  return typeof navigator !== "undefined" ? navigator : undefined;
}

function envLocation(env) {
  if (Object.prototype.hasOwnProperty.call(env, "location")) {
    return env.location || undefined;
  }
  const win = envWindow(env);
  return win?.location;
}

function isSecurePushContext(loc) {
  if (!loc) return false;
  const hostname = String(loc.hostname || "");
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  return loc.protocol === "https:" || isLocalhost;
}

/**
 * Standards-based push capability for the current browser context.
 * @param {{ window?: Window, navigator?: Navigator, location?: Location }} [env]
 */
export function getPushCapability(env = {}) {
  const win = envWindow(env);
  const nav = envNavigator(env);
  const loc = envLocation(env);

  if (!win || !nav) {
    return {
      capability: PUSH_CAPABILITY.UNSUPPORTED,
      canSubscribe: false,
      permission: "default",
      isIos: false,
      isStandalone: false,
    };
  }

  const isIos = detectIosDevice(env);
  const isStandalone = detectStandaloneDisplayMode(env);
  const hasPushManager =
    Boolean(nav.serviceWorker) &&
    typeof win.PushManager !== "undefined" &&
    typeof win.Notification !== "undefined" &&
    isSecurePushContext(loc);

  const notificationApi = win.Notification;

  if (!hasPushManager) {
    return {
      capability: PUSH_CAPABILITY.UNSUPPORTED,
      canSubscribe: false,
      permission: notificationApi?.permission ?? "default",
      isIos,
      isStandalone,
    };
  }

  if (isIos && !isStandalone) {
    return {
      capability: PUSH_CAPABILITY.IOS_NOT_INSTALLED,
      canSubscribe: false,
      permission: notificationApi?.permission ?? "default",
      isIos,
      isStandalone,
    };
  }

  const permission = notificationApi?.permission ?? "default";

  if (permission === "denied") {
    return {
      capability: PUSH_CAPABILITY.PERMISSION_DENIED,
      canSubscribe: false,
      permission,
      isIos,
      isStandalone,
    };
  }

  if (permission === "granted") {
    return {
      capability: isIos && isStandalone
        ? PUSH_CAPABILITY.IOS_INSTALLED
        : PUSH_CAPABILITY.PERMISSION_GRANTED,
      canSubscribe: true,
      permission,
      isIos,
      isStandalone,
    };
  }

  return {
    capability: isIos && isStandalone
      ? PUSH_CAPABILITY.IOS_INSTALLED
      : PUSH_CAPABILITY.PERMISSION_DEFAULT,
    canSubscribe: true,
    permission,
    isIos,
    isStandalone,
  };
}

/**
 * @param {{ navigator?: Navigator }} [env]
 */
export function detectPushPlatformLabel(env = {}) {
  const nav = envNavigator(env);
  const ua = String(nav?.userAgent || "");
  if (/iPhone|iPod|iPad/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * @param {string} base64UrlKey
 */
export function urlBase64ToUint8Array(base64UrlKey) {
  const padding = "=".repeat((4 - (base64UrlKey.length % 4)) % 4);
  const base64 = (base64UrlKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
