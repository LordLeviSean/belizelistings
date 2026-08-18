import { readPendingProtectedEntry } from "./auth/protectedEntry";

/** Session-scoped pending action after guest attempts authenticated listing engagement. */
export const PENDING_LISTING_ENGAGEMENT_KEY = "bl_pending_listing_engagement";

export const LISTING_ENGAGEMENT_ACTIONS = Object.freeze({
  MESSAGE: "message",
  VIEWING: "viewing",
});

const ENGAGEMENT_TTL_MS = 30 * 60 * 1000;

/**
 * Allow only same-origin relative paths (blocks open redirects).
 * @param {string|string[]|undefined|null} raw
 * @returns {string|null}
 */
export function normalizeReturnTo(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.startsWith("/login") || s.startsWith("/auth/")) return null;
  return s;
}

export function buildListingReturnPath(listingId) {
  const id = String(listingId || "").trim();
  return id ? `/listing/${encodeURIComponent(id)}` : null;
}

/**
 * @param {{ listingId: string, action: string, returnPath?: string|null, ts?: number }} payload
 */
export function serializePendingListingEngagement(payload) {
  const listingId = String(payload?.listingId || "").trim();
  const action = String(payload?.action || "").trim();
  if (!listingId || !action) return null;
  const returnPath =
    normalizeReturnTo(payload?.returnPath) || buildListingReturnPath(listingId);
  return JSON.stringify({
    listingId,
    action,
    returnPath,
    ts: Number(payload?.ts) || Date.now(),
  });
}

/**
 * @param {string|null|undefined} raw
 * @param {{ listingId?: string|null, maxAgeMs?: number }} [opts]
 */
export function parsePendingListingEngagement(raw, opts = {}) {
  if (!raw) return null;
  try {
    const data = JSON.parse(String(raw));
    const listingId = String(data?.listingId || "").trim();
    const action = String(data?.action || "").trim();
    const returnPath = normalizeReturnTo(data?.returnPath) || buildListingReturnPath(listingId);
    const ts = Number(data?.ts);
    if (!listingId || !action || !Number.isFinite(ts)) return null;
    const maxAge = Number(opts.maxAgeMs) > 0 ? Number(opts.maxAgeMs) : ENGAGEMENT_TTL_MS;
    if (Date.now() - ts > maxAge) return null;
    if (opts.listingId && String(opts.listingId) !== listingId) return null;
    return { listingId, action, returnPath, ts };
  } catch {
    return null;
  }
}

export function savePendingListingEngagement({ listingId, action, returnPath }) {
  if (typeof window === "undefined") return;
  const serialized = serializePendingListingEngagement({ listingId, action, returnPath });
  if (!serialized) return;
  try {
    window.sessionStorage.setItem(PENDING_LISTING_ENGAGEMENT_KEY, serialized);
  } catch {
    /* quota / private mode */
  }
}

export function readPendingListingEngagement(listingId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_LISTING_ENGAGEMENT_KEY);
    return parsePendingListingEngagement(raw, { listingId: listingId ?? undefined });
  } catch {
    return null;
  }
}

export function readAnyPendingListingEngagement() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_LISTING_ENGAGEMENT_KEY);
    return parsePendingListingEngagement(raw);
  } catch {
    return null;
  }
}

export function clearPendingListingEngagement() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_LISTING_ENGAGEMENT_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePostAuthEngagementReturnPath() {
  const pending = readAnyPendingListingEngagement();
  return pending?.returnPath || null;
}

export function resolvePostAuthProtectedEntryPath() {
  return readPendingProtectedEntry()?.href ?? null;
}

export function shouldTriggerListingEngagementAction(action) {
  return (
    action === LISTING_ENGAGEMENT_ACTIONS.MESSAGE ||
    action === LISTING_ENGAGEMENT_ACTIONS.VIEWING
  );
}
