/** Once-per-browser-session homepage splash (masks initial paint, not data loading). */

export const HOME_SPLASH_SESSION_KEY = "bl_home_splash_seen_v1";
export const HOME_SPLASH_HOLD_MS = 3000;

export function prefersReducedMotionSplash() {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function hasSeenHomeSplashThisSession() {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(HOME_SPLASH_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHomeSplashSeenThisSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HOME_SPLASH_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} Whether splash should show on this fresh session visit. */
export function shouldShowHomeSessionSplash() {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotionSplash()) return false;
  return !hasSeenHomeSplashThisSession();
}

/** District palette tones from interactive map / wordmark identity. */
export const HOME_SPLASH_PALETTE = Object.freeze([
  "#89cdbd",
  "#90c2c8",
  "#89b7db",
  "#9fb3d9",
  "#d8c27b",
  "#e8a898",
  "#8ac89b",
]);
