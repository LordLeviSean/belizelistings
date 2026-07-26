/** Default closed-listing archive window — 48 hours (2880 minutes). */
export const DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES = 48 * 60;

/** @deprecated use resolveListingClosedArchiveMinutes — kept for docs referencing hours */
export const RECENTLY_CLOSED_ARCHIVE_HOURS = DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES / 60;

/** @deprecated use RECENTLY_CLOSED_ARCHIVE_HOURS */
export const RECENTLY_CLOSED_DISPLAY_DAYS = RECENTLY_CLOSED_ARCHIVE_HOURS / 24;

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/**
 * Canonical archive window in minutes.
 * Override with LISTING_CLOSED_ARCHIVE_MINUTES (server) or
 * NEXT_PUBLIC_LISTING_CLOSED_ARCHIVE_MINUTES (client browse/UI).
 */
export function resolveListingClosedArchiveMinutes(env = process.env) {
  const raw =
    env?.LISTING_CLOSED_ARCHIVE_MINUTES ??
    env?.NEXT_PUBLIC_LISTING_CLOSED_ARCHIVE_MINUTES ??
    "";
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES;
}

export function recentlyClosedArchiveMs(env = process.env) {
  return resolveListingClosedArchiveMinutes(env) * MS_PER_MINUTE;
}

/** @deprecated use recentlyClosedArchiveMs */
export function recentlyClosedDisplayMs(env = process.env) {
  return recentlyClosedArchiveMs(env);
}

/**
 * @param {string|Date|null|undefined} closedAt
 * @param {number} [nowMs]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isWithinRecentlyClosedWindow(closedAt, nowMs = Date.now(), env = process.env) {
  if (!closedAt) return false;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= recentlyClosedArchiveMs(env);
}

/**
 * True when closed_at is old enough for the archive processor.
 * @param {string|Date|null|undefined} closedAt
 * @param {number} [nowMs]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isEligibleForClosedListingArchive(closedAt, nowMs = Date.now(), env = process.env) {
  if (!closedAt) return false;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts >= recentlyClosedArchiveMs(env);
}

/**
 * Resolve sold_at / rented_at / closed_at for window checks.
 * Falls back to updated_at so recently closed rows stay public when close columns are absent.
 * @param {object} listing
 */
export function getListingClosedAt(listing) {
  return (
    listing?.closed_at ||
    listing?.sold_at ||
    listing?.rented_at ||
    listing?.updated_at ||
    null
  );
}

/**
 * Archive deadline derived from canonical closed timestamp + configured window.
 * @param {object} listing
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Date|null}
 */
export function getListingArchiveDeadline(listing, env = process.env) {
  const closedAt = getListingClosedAt(listing);
  if (!closedAt) return null;
  const ts = new Date(closedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return new Date(ts + recentlyClosedArchiveMs(env));
}

/**
 * Whether a recently closed listing is still within the public display window.
 * @param {object} listing
 * @param {number} [nowMs]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isListingWithinRecentlyClosedWindow(listing, nowMs = Date.now(), env = process.env) {
  const closedAt = getListingClosedAt(listing);
  if (!closedAt) return false;
  return isWithinRecentlyClosedWindow(closedAt, nowMs, env);
}

/**
 * Whether a recently closed listing is eligible for automatic archival.
 * Uses the same canonical closed timestamp as public visibility.
 * @param {object} listing
 * @param {number} [nowMs]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isListingEligibleForClosedArchive(listing, nowMs = Date.now(), env = process.env) {
  return isEligibleForClosedListingArchive(getListingClosedAt(listing), nowMs, env);
}
