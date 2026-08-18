/**
 * Shared protected-entry contract for push, Notification Center, direct URLs,
 * refresh, and PWA cold start.
 *
 * URL remains authoritative; sessionStorage is bootstrap continuity only.
 */

import { loginHref } from "@/constants/authRoutes";
import { normalizeReturnTo } from "@/lib/authEngagementReturn";
import { DASHBOARD_ENTITY_PARAMS } from "@/lib/dashboard/dashboardIntent";

export const PENDING_PROTECTED_ENTRY_KEY = "bl_pending_protected_entry";

/** @readonly */
export const PROTECTED_ENTRY_PHASE = Object.freeze({
  BOOTING: "booting",
  ROUTER_PENDING: "router_pending",
  SESSION_PENDING: "session_pending",
  IDENTITY_PENDING: "identity_pending",
  DESTINATION_READY: "destination_ready",
  ADMITTED: "admitted",
  REDIRECT_LOGIN: "redirect_login",
  REDIRECT_ROLE: "redirect_role",
  READY: "ready",
});

const PROTECTED_DASHBOARD_PREFIXES = Object.freeze([
  "/dashboard/user",
  "/dashboard/agent",
  "/dashboard/broker",
  "/dashboard/create",
  "/admin",
]);

const ENTRY_TTL_MS = 30 * 60 * 1000;

function nowMs() {
  return Date.now();
}

/**
 * @param {string|null|undefined} pathname
 */
export function isProtectedDashboardPath(pathname) {
  const path = String(pathname || "").trim();
  if (!path) return false;
  return PROTECTED_DASHBOARD_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
}

/**
 * @param {string|null|undefined} href
 */
export function normalizeProtectedEntryHref(href) {
  const normalized = normalizeReturnTo(href);
  if (!normalized) return null;
  if (!isProtectedDashboardPath(normalized.split("?")[0])) return null;
  return normalized;
}

/**
 * Build canonical href from pathname + search.
 * @param {{ pathname?: string, search?: string }} location
 */
export function buildProtectedEntryHrefFromLocation({ pathname = "", search = "" } = {}) {
  const path = String(pathname || "").trim();
  if (!isProtectedDashboardPath(path)) return null;
  const query = String(search || "").trim();
  const href = query ? `${path}${query.startsWith("?") ? query : `?${query}`}` : path;
  return normalizeProtectedEntryHref(href);
}

/**
 * @param {{ pathname?: string, search?: string, hash?: string }} [location]
 */
export function captureProtectedEntryFromWindow(location) {
  if (typeof window === "undefined") return null;
  const pathname = location?.pathname ?? window.location.pathname;
  const search = location?.search ?? window.location.search;
  return buildProtectedEntryHrefFromLocation({ pathname, search });
}

/**
 * @param {string} href
 */
export function serializePendingProtectedEntry(href) {
  const normalized = normalizeProtectedEntryHref(href);
  if (!normalized) return null;
  return JSON.stringify({ href: normalized, ts: nowMs() });
}

/**
 * @param {string|null|undefined} raw
 * @param {{ maxAgeMs?: number }} [opts]
 */
export function parsePendingProtectedEntry(raw, opts = {}) {
  if (!raw) return null;
  try {
    const data = JSON.parse(String(raw));
    const href = normalizeProtectedEntryHref(data?.href);
    const ts = Number(data?.ts);
    if (!href || !Number.isFinite(ts)) return null;
    const maxAge = Number(opts.maxAgeMs) > 0 ? Number(opts.maxAgeMs) : ENTRY_TTL_MS;
    if (nowMs() - ts > maxAge) return null;
    return { href, ts };
  } catch {
    return null;
  }
}

/**
 * @param {string} href
 */
export function savePendingProtectedEntry(href) {
  if (typeof window === "undefined") return null;
  const serialized = serializePendingProtectedEntry(href);
  if (!serialized) return null;
  try {
    window.sessionStorage.setItem(PENDING_PROTECTED_ENTRY_KEY, serialized);
  } catch {
    /* quota / private mode */
  }
  return normalizeProtectedEntryHref(href);
}

export function readPendingProtectedEntry() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_PROTECTED_ENTRY_KEY);
    return parsePendingProtectedEntry(raw);
  } catch {
    return null;
  }
}

export function clearPendingProtectedEntry() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_PROTECTED_ENTRY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the protected destination from live URL first, then session backup.
 *
 * @param {{
 *   router?: { isReady?: boolean, asPath?: string, pathname?: string },
 *   pendingFromStorage?: { href?: string|null } | null,
 * }} [input]
 */
export function resolveProtectedEntryHref(input = {}) {
  const router = input.router;
  const fromStorage = normalizeProtectedEntryHref(input.pendingFromStorage?.href ?? null);

  if (typeof window !== "undefined") {
    const fromWindow = captureProtectedEntryFromWindow();
    if (fromWindow) return fromWindow;
  }

  if (router?.isReady) {
    const fromRouter = buildProtectedEntryHrefFromLocation({
      pathname: router.pathname,
      search: router.asPath?.includes("?") ? `?${router.asPath.split("?")[1]}` : "",
    });
    if (fromRouter) return fromRouter;
  }

  return fromStorage;
}

/**
 * @param {string|null|undefined} returnPath
 */
export function buildProtectedLoginHref(returnPath) {
  return loginHref({ returnTo: normalizeProtectedEntryHref(returnPath) });
}

/**
 * Extract entity params from a protected href path+query.
 * @param {string|null|undefined} href
 */
export function readProtectedEntryIntent(href) {
  const normalized = normalizeProtectedEntryHref(href);
  if (!normalized) {
    return { tab: null, conversation: null, viewing: null, listing: null };
  }

  let query = "";
  try {
    const url = new URL(normalized, "https://belizelistings.local");
    query = url.search;
  } catch {
    const idx = normalized.indexOf("?");
    query = idx >= 0 ? normalized.slice(idx) : "";
  }

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  return {
    tab: params.get("tab"),
    viewing: params.get("viewing"),
    conversation: params.get("conversation"),
    listing: params.get("listing"),
  };
}

/**
 * @param {string|null|undefined} href
 */
export function protectedEntryHasEntityIntent(href) {
  const intent = readProtectedEntryIntent(href);
  return DASHBOARD_ENTITY_PARAMS.some((key) => Boolean(intent[key]));
}

/**
 * Map dashboard bootstrap inputs to protected-entry phase semantics.
 *
 * @param {{
 *   routerReady?: boolean,
 *   authLoading?: boolean,
 *   authSettled?: boolean,
 *   user?: { id?: string } | null,
 *   role?: string | null,
 *   expectedRole?: string | null,
 *   profileHydrated?: boolean,
 *   destinationHref?: string | null,
 *   admitted?: boolean,
 * }} input
 */
export function resolveProtectedEntryPhase({
  routerReady = false,
  authLoading = false,
  authSettled = false,
  user = null,
  role = null,
  expectedRole = null,
  profileHydrated = false,
  destinationHref = null,
  admitted = false,
} = {}) {
  if (!routerReady) return PROTECTED_ENTRY_PHASE.ROUTER_PENDING;
  if (!authSettled || authLoading) return PROTECTED_ENTRY_PHASE.SESSION_PENDING;

  if (!user?.id) return PROTECTED_ENTRY_PHASE.REDIRECT_LOGIN;

  if (expectedRole && role !== expectedRole) {
    return PROTECTED_ENTRY_PHASE.REDIRECT_ROLE;
  }

  if (loadingProfilePending(authLoading, profileHydrated, role, expectedRole)) {
    return PROTECTED_ENTRY_PHASE.IDENTITY_PENDING;
  }

  if (destinationHref && !admitted) {
    return PROTECTED_ENTRY_PHASE.DESTINATION_READY;
  }

  if (admitted || !destinationHref) {
    return PROTECTED_ENTRY_PHASE.READY;
  }

  return PROTECTED_ENTRY_PHASE.DESTINATION_READY;
}

function loadingProfilePending(authLoading, profileHydrated, role, expectedRole) {
  return Boolean(authLoading && profileHydrated && role === expectedRole);
}

/**
 * Whether login/role redirects may run (terminal auth, not mid-restore).
 * @param {string} phase
 */
export function shouldRunProtectedEntryRedirect(phase) {
  return (
    phase === PROTECTED_ENTRY_PHASE.REDIRECT_LOGIN ||
    phase === PROTECTED_ENTRY_PHASE.REDIRECT_ROLE
  );
}

/**
 * Acknowledge ownership once dashboard role + Pass 1 intent are admitted.
 *
 * @param {{
 *   pathname?: string,
 *   expectedRole?: string | null,
 *   role?: string | null,
 *   intent?: { tab?: string|null, conversation?: string|null, viewing?: string|null, listing?: string|null },
 *   destinationHref?: string | null,
 * }} input
 */
export function shouldAcknowledgeProtectedEntry({
  pathname,
  expectedRole = null,
  role = null,
  intent = {},
  destinationHref = null,
} = {}) {
  if (!isProtectedDashboardPath(pathname)) return false;
  if (expectedRole && role !== expectedRole) return false;
  if (!destinationHref) return true;

  const destinationIntent = readProtectedEntryIntent(destinationHref);
  for (const param of DASHBOARD_ENTITY_PARAMS) {
    const expected = destinationIntent[param];
    if (!expected) continue;
    if (String(intent[param] ?? "") !== String(expected)) return false;
  }

  return true;
}
