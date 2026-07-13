import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";

/** Launch window: July 13–14, 2026 America/Belize (UTC-6, no DST). */
export const GEOGRAPHIC_UPDATE_LAUNCH_WINDOW = Object.freeze({
  timezone: "America/Belize",
  startUtc: "2026-07-13T06:00:00.000Z",
  endUtc: "2026-07-15T05:59:59.999Z",
  label: "2026-07-13 through end of 2026-07-14 (America/Belize)",
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

const LS_KEY = "bl_geo_update_modal_seen_v1";

export function isWithinGeographicUpdateLaunchWindow(now = new Date()) {
  const t = now.getTime();
  return (
    t >= Date.parse(GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.startUtc) &&
    t <= Date.parse(GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.endUtc)
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

export function hasSeenGeographicUpdateModalLocal() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGeographicUpdateModalSeenLocal() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ id?: string, geographic_update_modal_seen_at?: string|null }} profile
 */
export function hasSeenGeographicUpdateModal(profile) {
  if (profile?.geographic_update_modal_seen_at) return true;
  return hasSeenGeographicUpdateModalLocal();
}

export function isGeographicUpdateModalEligible({ authenticated, role, profile, now } = {}) {
  if (!authenticated || !canManageListingsRole(role)) return false;
  if (!isWithinGeographicUpdateLaunchWindow(now)) return false;
  if (hasSeenGeographicUpdateModal(profile)) return false;
  return true;
}

/**
 * Persist dismissal — profile field when available, localStorage fallback.
 */
export async function markGeographicUpdateModalSeen(userId, supabase, { action } = {}) {
  markGeographicUpdateModalSeenLocal();
  if (!userId || !supabase?.from) return { ok: true, local: true };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ geographic_update_modal_seen_at: now })
    .eq("id", userId);
  if (error) return { ok: false, error, action };
  return { ok: true, action };
}
