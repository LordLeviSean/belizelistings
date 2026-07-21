/** Hours after sold/rented confirmation before automatic archival. */
export const RECENTLY_CLOSED_ARCHIVE_HOURS = 48;

/** @deprecated use RECENTLY_CLOSED_ARCHIVE_HOURS — kept for docs referencing days */
export const RECENTLY_CLOSED_DISPLAY_DAYS = RECENTLY_CLOSED_ARCHIVE_HOURS / 24;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export function recentlyClosedArchiveMs() {
  return RECENTLY_CLOSED_ARCHIVE_HOURS * MS_PER_HOUR;
}

/** @deprecated use recentlyClosedArchiveMs */
export function recentlyClosedDisplayMs() {
  return recentlyClosedArchiveMs();
}

/**
 * @param {string|Date|null|undefined} closedAt
 * @param {number} [nowMs]
 */
export function isWithinRecentlyClosedWindow(closedAt, nowMs = Date.now()) {
  if (!closedAt) return false;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= recentlyClosedArchiveMs();
}

/**
 * True when closed_at is old enough for the archive processor.
 * @param {string|Date|null|undefined} closedAt
 * @param {number} [nowMs]
 */
export function isEligibleForClosedListingArchive(closedAt, nowMs = Date.now()) {
  if (!closedAt) return false;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts >= recentlyClosedArchiveMs();
}

/**
 * Resolve sold_at / rented_at / closed_at for window checks.
 * @param {object} listing
 */
export function getListingClosedAt(listing) {
  return listing?.closed_at || listing?.sold_at || listing?.rented_at || null;
}
