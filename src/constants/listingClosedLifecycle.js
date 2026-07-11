/** Temporary public display window for recently sold/rented listings (days). */
export const RECENTLY_CLOSED_DISPLAY_DAYS = 30;

export const MS_PER_DAY = 86_400_000;

export function recentlyClosedDisplayMs() {
  return RECENTLY_CLOSED_DISPLAY_DAYS * MS_PER_DAY;
}

/**
 * @param {string|Date|null|undefined} closedAt
 * @param {number} [nowMs]
 */
export function isWithinRecentlyClosedWindow(closedAt, nowMs = Date.now()) {
  if (!closedAt) return false;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= recentlyClosedDisplayMs();
}

/**
 * Resolve sold_at / rented_at / closed_at for window checks.
 * @param {object} listing
 */
export function getListingClosedAt(listing) {
  return listing?.sold_at || listing?.rented_at || listing?.closed_at || null;
}
