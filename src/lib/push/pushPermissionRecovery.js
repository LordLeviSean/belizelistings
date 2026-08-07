/**
 * Browser-appropriate guidance when Notification.permission is "denied".
 * Websites cannot programmatically unblock a denied permission.
 */

export const BLOCKED_NOTIFICATION_STEPS = Object.freeze([
  "Open the site controls beside the address bar (lock or tune icon).",
  "Find Notifications.",
  "Change Block to Allow or Ask.",
  "Return here and tap Check again.",
]);

/**
 * @param {{ window?: Window, navigator?: Navigator, location?: Location }} [env]
 */
export function getNotificationPermissionRecovery(env = {}) {
  const win =
    env.window ?? (typeof window !== "undefined" ? window : undefined);
  const nav =
    env.navigator ?? (typeof navigator !== "undefined" ? navigator : undefined);
  const loc =
    env.location ??
    win?.location ??
    (typeof window !== "undefined" ? window.location : undefined);

  const permission =
    win?.Notification?.permission ??
    (typeof Notification !== "undefined" ? Notification.permission : "default");

  const recovery = {
    permission,
    canOpenSettings: false,
    openSettings: null,
    settingsActionLabel: "How to unblock",
    steps: [...BLOCKED_NOTIFICATION_STEPS],
    siteHost: loc?.host ? String(loc.host) : "this site",
  };

  if (permission !== "denied") {
    return recovery;
  }

  // No cross-browser web API safely opens site notification settings.
  // Keep instructions-only unless a vetted browser hook is added later.
  void nav;
  return recovery;
}

/**
 * @param {{ window?: Window }} [env]
 */
export function isNotificationPermissionDenied(env = {}) {
  const win =
    env.window ?? (typeof window !== "undefined" ? window : undefined);
  const permission =
    win?.Notification?.permission ??
    (typeof Notification !== "undefined" ? Notification.permission : "default");
  return permission === "denied";
}
