import { ACTIVITY_SIGNAL_TYPES, VERIFICATION_STATUS } from "../constants/trustModel";
import { LISTING_LIFECYCLE, normalizeLifecycleStatus } from "../constants/operationalModel";
import { getLifecycleTimestamps } from "./listingOperationalMeta";

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getRelativeTimeLabel(value) {
  const date = parseDate(value);
  if (!date) return "unknown";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function getStaleInventoryState(listing = {}) {
  const lifecycle = normalizeLifecycleStatus(listing?.status);
  const timestamps = getLifecycleTimestamps(listing);
  const anchor = timestamps.updatedAt || timestamps.publishedAt || timestamps.createdAt;
  if (!anchor) return { isStale: false, isAging: false };
  const ageDays = Math.floor((Date.now() - anchor.getTime()) / MS_IN_DAY);
  if (lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW && ageDays >= 5) {
    return { isStale: true, isAging: true, ageDays };
  }
  if (lifecycle === LISTING_LIFECYCLE.PUBLISHED && ageDays >= 45) {
    return { isStale: true, isAging: true, ageDays };
  }
  if (ageDays >= 21) {
    return { isStale: false, isAging: true, ageDays };
  }
  return { isStale: false, isAging: false, ageDays };
}

export function getListingActivitySignals(listing = {}) {
  const now = Date.now();
  const lifecycle = normalizeLifecycleStatus(listing?.status);
  const timestamps = getLifecycleTimestamps(listing);
  const signals = [];

  if (timestamps.createdAt && now - timestamps.createdAt.getTime() <= 72 * MS_IN_HOUR) {
    signals.push(ACTIVITY_SIGNAL_TYPES.RECENTLY_ADDED);
  }

  if (timestamps.updatedAt && now - timestamps.updatedAt.getTime() <= MS_IN_DAY) {
    signals.push(ACTIVITY_SIGNAL_TYPES.UPDATED_TODAY);
  }

  if (timestamps.publishedAt && now - timestamps.publishedAt.getTime() <= 72 * MS_IN_HOUR) {
    signals.push(ACTIVITY_SIGNAL_TYPES.NEWLY_APPROVED);
  }

  if (timestamps.verifiedAt && now - timestamps.verifiedAt.getTime() <= 72 * MS_IN_HOUR) {
    signals.push(ACTIVITY_SIGNAL_TYPES.RECENTLY_VERIFIED);
  }

  if (lifecycle === LISTING_LIFECYCLE.RENTED && timestamps.rentedAt) {
    if (now - timestamps.rentedAt.getTime() <= 48 * MS_IN_HOUR) {
      signals.push(ACTIVITY_SIGNAL_TYPES.RECENTLY_RENTED);
    }
  }

  if (lifecycle === LISTING_LIFECYCLE.SOLD && timestamps.soldAt) {
    if (now - timestamps.soldAt.getTime() <= 48 * MS_IN_HOUR) {
      signals.push(ACTIVITY_SIGNAL_TYPES.RECENTLY_SOLD);
    }
  }

  if (
    lifecycle === LISTING_LIFECYCLE.PUBLISHED &&
    timestamps.updatedAt &&
    now - timestamps.updatedAt.getTime() <= 7 * MS_IN_DAY
  ) {
    signals.push(ACTIVITY_SIGNAL_TYPES.FRESH_INVENTORY);
  }

  return signals;
}

export function getListingTrustSnapshot(listing = {}) {
  const activitySignals = getListingActivitySignals(listing);
  const lifecycle = normalizeLifecycleStatus(listing?.status);
  const verificationStatus = String(
    listing?.verification_status || listing?.inventory_verification_status || "unverified"
  )
    .trim()
    .toLowerCase();

  return {
    lifecycle,
    verificationStatus:
      verificationStatus === VERIFICATION_STATUS.PENDING ||
      verificationStatus === VERIFICATION_STATUS.VERIFIED ||
      verificationStatus === VERIFICATION_STATUS.REVOKED
        ? verificationStatus
        : VERIFICATION_STATUS.UNVERIFIED,
    activitySignals,
    hasRecentTransactionSignal:
      activitySignals.includes(ACTIVITY_SIGNAL_TYPES.RECENTLY_RENTED) ||
      activitySignals.includes(ACTIVITY_SIGNAL_TYPES.RECENTLY_SOLD),
  };
}

export function getAgentTrustSnapshot(profile = {}, listings = []) {
  const now = Date.now();
  const verifiedAt = parseDate(profile?.verified_at || profile?.verification_at);
  const activeListings = listings.filter(
    (item) => normalizeLifecycleStatus(item?.status) === LISTING_LIFECYCLE.PUBLISHED
  ).length;
  const recentTransactions = listings.filter((item) => {
    const lifecycle = normalizeLifecycleStatus(item?.status);
    const timestamps = getLifecycleTimestamps(item);
    if (lifecycle === LISTING_LIFECYCLE.RENTED && timestamps.rentedAt) {
      return now - timestamps.rentedAt.getTime() <= 30 * MS_IN_DAY;
    }
    if (lifecycle === LISTING_LIFECYCLE.SOLD && timestamps.soldAt) {
      return now - timestamps.soldAt.getTime() <= 30 * MS_IN_DAY;
    }
    return false;
  }).length;

  return {
    verifiedAt,
    activeListings,
    recentTransactions,
    hasVerifiedIdentity: Boolean(verifiedAt),
  };
}

export function getAgentOperationalSnapshot({
  agentId = "",
  listings = [],
  profile = {},
} = {}) {
  const ownerListings = listings.filter(
    (item) => String(item?.user_id || "") === String(agentId || "")
  );
  const now = Date.now();
  const lifecycleCounts = {
    active: 0,
    archived: 0,
    pending: 0,
    closed: 0,
    total: ownerListings.length,
  };
  let freshActiveCount = 0;
  let lastActivityAt = null;
  let verifiedClosings = 0;
  let brokerageAffiliated = Boolean(
    profile?.brokerage_id || profile?.brokerage || profile?.brokerage_name
  );

  for (const listing of ownerListings) {
    const lifecycle = normalizeLifecycleStatus(listing?.status);
    const ts = getLifecycleTimestamps(listing);
    const updatedAt = ts.updatedAt || ts.publishedAt || ts.createdAt;

    if (!lastActivityAt || (updatedAt && updatedAt.getTime() > lastActivityAt.getTime())) {
      lastActivityAt = updatedAt || lastActivityAt;
    }

    if (lifecycle === LISTING_LIFECYCLE.PUBLISHED) {
      lifecycleCounts.active += 1;
      if (updatedAt && now - updatedAt.getTime() <= 14 * MS_IN_DAY) {
        freshActiveCount += 1;
      }
    } else if (lifecycle === LISTING_LIFECYCLE.ARCHIVED) {
      lifecycleCounts.archived += 1;
    } else if (lifecycle === LISTING_LIFECYCLE.PENDING_REVIEW) {
      lifecycleCounts.pending += 1;
    }

    if (lifecycle === LISTING_LIFECYCLE.RENTED || lifecycle === LISTING_LIFECYCLE.SOLD) {
      lifecycleCounts.closed += 1;
      if (
        String(listing?.closing_verification_status || listing?.verification_status || "")
          .trim()
          .toLowerCase() === VERIFICATION_STATUS.VERIFIED
      ) {
        verifiedClosings += 1;
      }
    }

    if (!brokerageAffiliated && (listing?.agency_name || listing?.brokerage_name)) {
      brokerageAffiliated = true;
    }
  }

  const freshnessConsistency =
    lifecycleCounts.active > 0 ? freshActiveCount / lifecycleCounts.active : 0;

  return {
    agentId: String(agentId || ""),
    hasVerifiedIdentity: Boolean(profile?.verified_at || profile?.verification_at),
    lifecycleCounts,
    recentTransactions30d: ownerListings.filter((item) => {
      const lifecycle = normalizeLifecycleStatus(item?.status);
      const ts = getLifecycleTimestamps(item);
      if (lifecycle === LISTING_LIFECYCLE.RENTED && ts.rentedAt) {
        return now - ts.rentedAt.getTime() <= 30 * MS_IN_DAY;
      }
      if (lifecycle === LISTING_LIFECYCLE.SOLD && ts.soldAt) {
        return now - ts.soldAt.getTime() <= 30 * MS_IN_DAY;
      }
      return false;
    }).length,
    verifiedClosings,
    freshnessConsistency,
    recentlyActive:
      Boolean(lastActivityAt) && now - lastActivityAt.getTime() <= 7 * MS_IN_DAY,
    lastActivityAt,
    brokerageAffiliated,
  };
}

/**
 * Calm public-facing trust chips for listing detail (conversion surface).
 */
export function buildPublicListingTrustChips(listing = {}) {
  const chips = [];
  const snap = getListingTrustSnapshot(listing);
  const stale = getStaleInventoryState(listing);

  if (snap.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.UPDATED_TODAY)) {
    chips.push({ key: "fresh", label: "Recently updated" });
  } else if (snap.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.FRESH_INVENTORY)) {
    chips.push({ key: "fresh_inv", label: "Fresh on market" });
  }

  if (snap.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.NEWLY_APPROVED)) {
    chips.push({ key: "newly", label: "Newly listed" });
  }

  if (!stale.isStale && !stale.isAging && listing?.price > 0) {
    chips.push({ key: "active", label: "Active listing" });
  }

  if (snap.activitySignals.includes(ACTIVITY_SIGNAL_TYPES.RECENTLY_VERIFIED)) {
    chips.push({ key: "verified_recent", label: "Recently verified context" });
  }

  return chips.slice(0, 5);
}

export function buildAgentOperationalSnapshotMap(listings = [], profileMap = {}) {
  const ownerIds = [...new Set((listings || []).map((item) => String(item?.user_id || "")).filter(Boolean))];
  const map = {};
  for (const ownerId of ownerIds) {
    map[ownerId] = getAgentOperationalSnapshot({
      agentId: ownerId,
      listings,
      profile: profileMap[ownerId] || {},
    });
  }
  return map;
}

