const STORAGE_PREFIX = "bl_push_device_sub";

export function pushDeviceStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId}`;
}

/**
 * @param {string} userId
 * @returns {{ subscriptionId: string | null }}
 */
export function readStoredPushDevice(userId) {
  if (!userId || typeof window === "undefined") {
    return { subscriptionId: null };
  }
  try {
    const raw = window.localStorage.getItem(pushDeviceStorageKey(userId));
    if (!raw) return { subscriptionId: null };
    const parsed = JSON.parse(raw);
    const subscriptionId =
      typeof parsed?.subscriptionId === "string" ? parsed.subscriptionId : null;
    return { subscriptionId };
  } catch {
    return { subscriptionId: null };
  }
}

/**
 * @param {string} userId
 * @param {string} subscriptionId
 */
export function writeStoredPushDevice(userId, subscriptionId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      pushDeviceStorageKey(userId),
      JSON.stringify({ subscriptionId })
    );
  } catch {
    // Storage failures must not break subscription flow.
  }
}

/** @param {string} userId */
export function clearStoredPushDevice(userId) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(pushDeviceStorageKey(userId));
  } catch {
    // ignore
  }
}
