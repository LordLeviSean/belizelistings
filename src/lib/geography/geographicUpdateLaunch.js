import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";

/** Launch window — visitor local calendar dates (auto-expires after end date). */
export const GEOGRAPHIC_UPDATE_LAUNCH_WINDOW = Object.freeze({
  localStartDate: "2026-07-13",
  localEndDate: "2026-07-16",
  timezone: "America/Belize",
  startUtc: "2026-07-13T06:00:00.000Z",
  endUtc: "2026-07-17T05:59:59.999Z",
  label: "2026-07-13 through 2026-07-16 (visitor local calendar dates)",
});

export const GEOGRAPHIC_UPDATE_NOTIFICATION = Object.freeze({
  eventType: "geographic_update_v1",
  dedupeKey: "geographic_update_v1:2026-07-13",
  title: "Welcome to the Geographic Update! V1.0",
  body: "BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.",
  cta: "Update My Listings",
});

export const GEOGRAPHIC_UPDATE_MODAL_COPY = Object.freeze({
  title: GEOGRAPHIC_UPDATE_NOTIFICATION.title,
  body: "BelizeListings now includes detailed locations across Belize—from districts and towns to neighborhoods, villages, highways and mile markers.\n\nAlready have a listing? Update it now so buyers can find it in the correct area.",
  primaryCta: GEOGRAPHIC_UPDATE_NOTIFICATION.cta,
  secondaryCta: "Explore the Update",
});

const SESSION_KEY_PREFIX = "bl_geo_update_modal_session";

/** YYYY-MM-DD in the visitor's local timezone. */
export function getVisitorLocalDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isWithinGeographicUpdateLaunchWindow(now = new Date()) {
  const localDate = getVisitorLocalDateKey(now);
  return (
    localDate >= GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.localStartDate &&
    localDate <= GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.localEndDate
  );
}

export function canManageListingsRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "user" || r === "agent" || r === "admin" || r === "operator";
}

export function resolveGeographicUpdateListingsHref(role) {
  const r = String(role || "user").toLowerCase();
  if (r === "admin") return `/admin?tab=${ADMIN_DASHBOARD_TAB_IDS.LISTINGS}`;
  if (r === "agent") return `/dashboard/agent?tab=${AGENT_DASHBOARD_TAB_IDS.LISTINGS}`;
  if (r === "operator") return `/admin?tab=${ADMIN_DASHBOARD_TAB_IDS.OPERATOR}`;
  return `/dashboard/user?tab=${USER_DASHBOARD_TAB_IDS.MY_LISTINGS}`;
}

function sessionStorageKey(now = new Date()) {
  return `${SESSION_KEY_PREFIX}_${getVisitorLocalDateKey(now)}`;
}

export function hasSeenGeographicUpdateModalThisSession(now = new Date()) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(sessionStorageKey(now)) === "1";
  } catch {
    return false;
  }
}

export function markGeographicUpdateModalSeenThisSession(now = new Date()) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionStorageKey(now), "1");
  } catch {
    /* ignore */
  }
}

export function isGeographicUpdateModalEligible({ authenticated, role, now } = {}) {
  if (!authenticated || !canManageListingsRole(role)) return false;
  if (!isWithinGeographicUpdateLaunchWindow(now)) return false;
  if (hasSeenGeographicUpdateModalThisSession(now)) return false;
  return true;
}

/**
 * Persist dismissal for this browser session; profile timestamp when signed in (analytics only).
 */
export async function markGeographicUpdateModalSeen(userId, supabase, { action, now = new Date() } = {}) {
  markGeographicUpdateModalSeenThisSession(now);
  if (!userId || !supabase?.from) return { ok: true, session: true };
  const seenAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ geographic_update_modal_seen_at: seenAt })
    .eq("id", userId);
  if (error) return { ok: false, error, action };
  return { ok: true, action };
}
