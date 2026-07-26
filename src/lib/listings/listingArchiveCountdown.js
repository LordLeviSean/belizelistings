import { getListingArchiveDeadline } from "../../constants/listingClosedLifecycle";
import { LISTING_LIFECYCLE } from "../../constants/operationalModel";
import { getLifecycleStatus } from "../../utils/canonicalListing";

/**
 * @param {object} listing
 * @returns {boolean}
 */
export function shouldShowListingArchiveCountdown(listing) {
  const lc = getLifecycleStatus(listing);
  return lc === LISTING_LIFECYCLE.RECENTLY_SOLD || lc === LISTING_LIFECYCLE.RECENTLY_RENTED;
}

/**
 * @param {object} listing
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number|null}
 */
export function getListingArchiveDeadlineMs(listing, env = process.env) {
  const deadline = getListingArchiveDeadline(listing, env);
  if (!deadline) return null;
  const ms = deadline.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {number|null|undefined} deadlineMs
 * @param {number} [nowMs]
 * @returns {{ short: string, ariaLabel: string, expired: boolean, needsSecondPrecision?: boolean }|null}
 */
export function formatListingArchiveCountdown(deadlineMs, nowMs = Date.now()) {
  if (deadlineMs == null || !Number.isFinite(deadlineMs)) return null;

  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return {
      short: "Archiving shortly…",
      ariaLabel: "Archiving shortly",
      expired: true,
      needsSecondPrecision: true,
    };
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return {
      short: `Archives in ${totalSeconds}s`,
      ariaLabel: `Archives automatically in ${totalSeconds} ${
        totalSeconds === 1 ? "second" : "seconds"
      }`,
      expired: false,
      needsSecondPrecision: true,
    };
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return {
      short: `Archives in ${String(totalMinutes).padStart(2, "0")}m`,
      ariaLabel: `Archives automatically in ${totalMinutes} minutes`,
      expired: false,
      needsSecondPrecision: false,
    };
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    short: `Archives in ${hours}h ${String(minutes).padStart(2, "0")}m`,
    ariaLabel: `Archives automatically in ${hours} hours and ${minutes} minutes`,
    expired: false,
    needsSecondPrecision: false,
  };
}
