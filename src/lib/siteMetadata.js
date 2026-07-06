import { getRegionLabel } from "@/constants/geographyLayer";
import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";

export const SITE_NAME = "BelizeListings";
export const SITE_TAGLINE = "Belize's Living Property Map";
export const TITLE_SEPARATOR = " | ";

/** Canonical page titles (suffix always includes site name). */
export const PAGE_TITLES = Object.freeze({
  home: `${SITE_NAME}${TITLE_SEPARATOR}${SITE_TAGLINE}`,
  search: `Search Listings${TITLE_SEPARATOR}${SITE_NAME}`,
  favorites: `Favorites${TITLE_SEPARATOR}${SITE_NAME}`,
  dashboard: `Dashboard${TITLE_SEPARATOR}${SITE_NAME}`,
  messages: `Messages${TITLE_SEPARATOR}${SITE_NAME}`,
  notifications: `Notifications${TITLE_SEPARATOR}${SITE_NAME}`,
  login: `Login${TITLE_SEPARATOR}${SITE_NAME}`,
  register: `Create Account${TITLE_SEPARATOR}${SITE_NAME}`,
  admin: `Admin Dashboard${TITLE_SEPARATOR}${SITE_NAME}`,
});

const MESSAGES_TAB_IDS = new Set([
  USER_DASHBOARD_TAB_IDS.MESSAGES,
  ADMIN_DASHBOARD_TAB_IDS.MESSAGES,
]);

const NOTIFICATIONS_TAB_IDS = new Set(["notifications"]);

/**
 * Append site name when a segment is provided without the suffix.
 * @param {string} segment
 * @returns {string}
 */
export function formatPageTitle(segment) {
  const trimmed = String(segment || "").trim();
  if (!trimmed) return SITE_NAME;
  if (trimmed.endsWith(TITLE_SEPARATOR + SITE_NAME) || trimmed === SITE_NAME) {
    return trimmed;
  }
  return `${trimmed}${TITLE_SEPARATOR}${SITE_NAME}`;
}

/**
 * @param {string} districtLabel
 * @returns {string}
 */
export function formatDistrictTitle(districtLabel) {
  const label = String(districtLabel || "").trim() || "District";
  return `${label} Listings${TITLE_SEPARATOR}${SITE_NAME}`;
}

/**
 * @param {string} listingTitle
 * @returns {string}
 */
export function formatListingTitle(listingTitle) {
  const label = String(listingTitle || "").trim() || "Listing";
  return formatPageTitle(label);
}

/**
 * Normalize router tab query to a single lowercase string.
 * @param {string|string[]|undefined} raw
 * @returns {string}
 */
function normalizeTab(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Dashboard-family routes may expose Messages / Notifications via ?tab=.
 * @param {string} tab
 * @returns {string|null}
 */
export function resolveDashboardTabTitle(tab) {
  const normalized = normalizeTab(tab);
  if (!normalized) return null;
  if (MESSAGES_TAB_IDS.has(normalized)) return PAGE_TITLES.messages;
  if (NOTIFICATIONS_TAB_IDS.has(normalized)) return PAGE_TITLES.notifications;
  return null;
}

/**
 * Resolve a document title from pathname + query (static routes and dashboard tabs).
 * Dynamic pages (listing title, district label) should pass an explicit title.
 * @param {string} pathname
 * @param {Record<string, string|string[]|undefined>} [query]
 * @returns {string}
 */
export function resolveRouteTitle(pathname, query = {}) {
  const path = String(pathname || "").trim() || "/";
  const tabTitle = resolveDashboardTabTitle(query.tab);

  if (path === "/") return PAGE_TITLES.home;
  if (path === "/search") return PAGE_TITLES.search;
  if (path === "/favorites") return PAGE_TITLES.favorites;
  if (path === "/login" || path === "/signin") {
    const signup = normalizeTab(query.signup);
    return signup === "1" || signup === "true" ? PAGE_TITLES.register : PAGE_TITLES.login;
  }
  if (path === "/signup") return PAGE_TITLES.register;
  if (path === "/admin" || path.startsWith("/admin/")) {
    return tabTitle || PAGE_TITLES.admin;
  }
  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    return tabTitle || PAGE_TITLES.dashboard;
  }
  if (path.startsWith("/listings/district/")) {
    const slug = path.split("/").pop() || "";
    return formatDistrictTitle(getRegionLabel(slug));
  }
  if (path.startsWith("/listing/")) {
    return formatPageTitle("Listing");
  }

  return SITE_NAME;
}
