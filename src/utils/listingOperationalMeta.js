import { LISTING_LIFECYCLE, normalizeLifecycleStatus } from "../constants/operationalModel";

const DEFAULT_RECENT_WINDOW_HOURS = 48;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getLifecycleTimestamps(listing = {}) {
  return {
    createdAt: parseDate(listing.created_at),
    updatedAt: parseDate(listing.updated_at),
    publishedAt: parseDate(listing.published_at),
    verifiedAt: parseDate(listing.verified_at),
    rentedAt: parseDate(listing.rented_at),
    soldAt: parseDate(listing.sold_at),
    archivedAt: parseDate(listing.archived_at),
    reviewedAt: parseDate(listing.reviewed_at),
  };
}

export function getRecentTransactionMeta(listing = {}, windowHours = DEFAULT_RECENT_WINDOW_HOURS) {
  const lifecycle = normalizeLifecycleStatus(listing.status);
  const timestamps = getLifecycleTimestamps(listing);
  const now = Date.now();
  const windowMs = Math.max(1, Number(windowHours || DEFAULT_RECENT_WINDOW_HOURS)) * 60 * 60 * 1000;

  if (lifecycle === LISTING_LIFECYCLE.RENTED) {
    const at = timestamps.rentedAt || timestamps.updatedAt;
    if (!at) return null;
    return now - at.getTime() <= windowMs ? { kind: "rented", at } : null;
  }

  if (lifecycle === LISTING_LIFECYCLE.SOLD) {
    const at = timestamps.soldAt || timestamps.updatedAt;
    if (!at) return null;
    return now - at.getTime() <= windowMs ? { kind: "sold", at } : null;
  }

  return null;
}

export function getListingFreshnessDate(listing = {}) {
  const timestamps = getLifecycleTimestamps(listing);
  return (
    timestamps.updatedAt ||
    timestamps.publishedAt ||
    timestamps.reviewedAt ||
    timestamps.createdAt ||
    null
  );
}

export function formatOperationalTimestamp(value) {
  const date = parseDate(value);
  if (!date) return "Unknown";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const minutesAgo = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutesAgo >= 0 && minutesAgo <= 1) return "Just now";
  if (sameDay) {
    return `Today • ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString();
}

