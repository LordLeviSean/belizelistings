export const NAV_ALERT_BADGE_KEY = "belize_nav_alert_badge";

export function readNavAlertBadge() {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(NAV_ALERT_BADGE_KEY) || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function incrementNavAlertBadge(delta) {
  if (typeof window === "undefined" || delta <= 0) return;
  const next = readNavAlertBadge() + delta;
  localStorage.setItem(NAV_ALERT_BADGE_KEY, String(next));
  window.dispatchEvent(new Event("belize-nav-badge"));
}

export function clearNavAlertBadge() {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAV_ALERT_BADGE_KEY, "0");
  window.dispatchEvent(new Event("belize-nav-badge"));
}
