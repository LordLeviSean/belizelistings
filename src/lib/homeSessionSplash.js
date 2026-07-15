/** Once-per-browser-session homepage loading transition gate. */

export const HOME_SPLASH_SESSION_KEY = "bl_home_splash_seen_v1";

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

/** @returns {boolean} Whether the awakening transition should show on this fresh session visit. */
export function shouldShowHomeLoadingTransition() {
  if (typeof window === "undefined") return false;
  return !hasSeenHomeSplashThisSession();
}

/** District palette tones shared with interactive map + Learn More underwater world. */
export const HOME_MAP_DISTRICT_PALETTE = Object.freeze([
  "#89cdbd",
  "#90c2c8",
  "#89b7db",
  "#9fb3d9",
  "#d8c27b",
  "#e8a898",
  "#8ac89b",
  "#7eb8c4",
]);
