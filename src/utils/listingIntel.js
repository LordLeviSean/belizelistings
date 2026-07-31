import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { LISTING_HEALTH_TIER, AGENT_FEED_EVENT } from "../constants/operationalIntel";
import { getLifecycleStatus, getListingRegionSlug } from "./canonicalListing";
import { resolveListingImageUrl } from "./listingImage";
import { isLandInventoryListing } from "./listingPresentation";

const MS_DAY = 86400000;
const STALE_APPROVED_DAYS = 75;
const VERY_STALE_DAYS = 120;

function descLength(listing) {
  return String(listing?.description || "").trim().length;
}

function parseTs(listing) {
  const u = listing?.updated_at || listing?.updatedAt;
  const c = listing?.created_at || listing?.createdAt;
  const t = u || c;
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

/** Normalize image URLs from listing row (embedded images[] or listing_images). */
export function collectListingImageUrls(listing) {
  const rows = listing?.listing_images;
  if (Array.isArray(rows) && rows.length) {
    const urls = rows
      .map((r) => resolveListingImageUrl(r?.image_url ?? r?.url ?? ""))
      .filter(Boolean);
    return urls;
  }
  const imgs = listing?.images;
  if (!Array.isArray(imgs)) return [];
  return imgs
    .map((item) => {
      if (typeof item === "string") return resolveListingImageUrl(item);
      return resolveListingImageUrl(item?.image_url ?? item?.url ?? "");
    })
    .filter(Boolean);
}

/**
 * Lightweight image signals — no pixel ML. Duplicate URLs, counts, placeholder paths.
 */
export function analyzeImageHeuristics(listing) {
  const urls = collectListingImageUrls(listing);
  const normalized = urls.map((u) => String(u).split("?")[0].toLowerCase());
  const dupes = normalized.filter((u, i) => normalized.indexOf(u) !== i);
  const unique = [...new Set(normalized)];
  const placeholderUsed = urls.some((u) =>
    /placeholder|\/placeholder\./i.test(String(u))
  );

  const warnings = [];
  if (urls.length === 0) warnings.push({ code: "no_photos", severity: "critical", label: "No listing photos" });
  else if (urls.length < 2) warnings.push({ code: "low_photo_count", severity: "attention", label: "Add more photos" });

  if (dupes.length > 0)
    warnings.push({ code: "duplicate_images", severity: "attention", label: "Duplicate images detected" });

  if (placeholderUsed && urls.length > 0)
    warnings.push({ code: "placeholder_image", severity: "attention", label: "Replace placeholder imagery" });

  return {
    count: urls.length,
    uniqueCount: unique.length,
    hasCover: urls.length > 0,
    duplicateCount: dupes.length,
    warnings,
  };
}

function fieldWarnings(listing) {
  const w = [];
  const land = isLandInventoryListing(listing);
  const desc = String(listing?.description || "").trim();
  if (!land && desc.length < 40) {
    w.push({
      code: "short_description",
      severity: desc.length === 0 ? "critical" : "attention",
      label: "Description missing or thin",
    });
  }

  const price = Number(listing?.price ?? 0);
  if (!Number.isFinite(price) || price <= 0)
    w.push({ code: "no_price", severity: "critical", label: "Price not set" });

  const region = getListingRegionSlug(listing);
  const district = String(listing?.district || "").trim();
  if (!region && !district)
    w.push({ code: "no_region", severity: "attention", label: "District / region needed" });

  const ptype = String(listing?.property_type || listing?.type || "").trim();
  if (!ptype) w.push({ code: "no_property_type", severity: "attention", label: "Property type missing" });

  return w;
}

function moderationWarnings(listing, lc) {
  const w = [];
  if (lc === LISTING_LIFECYCLE.REJECTED)
    w.push({ code: "rejected_resubmit", severity: "attention", label: "Corrections needed — resubmit when ready" });
  if (lc === LISTING_LIFECYCLE.PENDING_REVIEW)
    w.push({ code: "pending_review", severity: "healthy", label: "Awaiting moderation" });
  return w;
}

function freshnessMeta(listing, lc) {
  const ts = parseTs(listing);
  const now = Date.now();
  const ageDays = ts ? Math.floor((now - ts) / MS_DAY) : null;
  let stale = false;
  let veryStale = false;
  if (lc === LISTING_LIFECYCLE.PUBLISHED && ageDays != null) {
    stale = ageDays >= STALE_APPROVED_DAYS;
    veryStale = ageDays >= VERY_STALE_DAYS;
  }
  return { ageDays, stale, veryStale, updatedAt: ts };
}

/**
 * Full listing intelligence snapshot for dashboards.
 */
export function evaluateListingIntel(listing) {
  const lc = getLifecycleStatus(listing);
  const land = isLandInventoryListing(listing);
  const images = analyzeImageHeuristics(listing);
  const fieldW = fieldWarnings(listing);
  const modW = moderationWarnings(listing, lc);
  const fresh = freshnessMeta(listing, lc);

  const allWarnings = [...images.warnings, ...fieldW, ...modW.filter((x) => x.severity !== "healthy")];

  let critical = 0;
  let attention = 0;
  for (const x of allWarnings) {
    if (x.severity === "critical") critical += 1;
    else if (x.severity === "attention") attention += 1;
  }
  if (fresh.stale && lc === LISTING_LIFECYCLE.PUBLISHED) {
    attention += 1;
    allWarnings.push({
      code: "stale_listing",
      severity: fresh.veryStale ? "attention" : "attention",
      label: fresh.veryStale
        ? "Listing hasn’t been refreshed in a while"
        : "Consider refreshing details for visibility",
    });
  }

  let tier = LISTING_HEALTH_TIER.EXCELLENT;
  if (critical >= 1 || images.count === 0) tier = LISTING_HEALTH_TIER.CRITICAL;
  else if (attention >= 2 || fresh.stale) tier = LISTING_HEALTH_TIER.NEEDS_ATTENTION;
  else if (attention >= 1 || images.count < 3) tier = LISTING_HEALTH_TIER.HEALTHY;

  if (tier === LISTING_HEALTH_TIER.EXCELLENT && (images.count < 4 || (!land && descLength(listing) < 120))) {
    tier = LISTING_HEALTH_TIER.HEALTHY;
  }

  const score = Math.max(
    0,
    Math.min(100, 100 - critical * 28 - attention * 12 - (fresh.stale ? 8 : 0))
  );

  return {
    lifecycle: lc,
    healthTier: tier,
    healthScore: score,
    warnings: allWarnings,
    imageIntel: images,
    freshness: fresh,
    performance: buildPerformanceStub(listing),
  };
}

function buildPerformanceStub(listing) {
  const views = listing?.view_count ?? listing?.views ?? listing?.viewCount;
  const favs = listing?.favorite_count ?? listing?.favorites_count ?? listing?.favoriteCount;
  const inquiries = listing?.inquiry_count ?? listing?.inquiries_count ?? null;
  const lastEngagement = parseTs(listing);

  return {
    views: typeof views === "number" ? views : null,
    favorites: typeof favs === "number" ? favs : null,
    inquiries: typeof inquiries === "number" ? inquiries : null,
    lastUpdatedLabel: lastEngagement ? formatRelativeDays(lastEngagement) : null,
    freshnessPulse: computePulse(listing),
  };
}

function computePulse(listing) {
  const v = listing?.view_count ?? listing?.views;
  if (typeof v === "number" && v > 50) return "high";
  if (typeof v === "number" && v > 10) return "steady";
  return "quiet";
}

function formatRelativeDays(ts) {
  const days = Math.floor((Date.now() - ts) / MS_DAY);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

/** Recent operational window for overview activity (ms). */
const RECENT_ACTIVITY_WINDOW_MS = 45 * MS_DAY;
/** Published listings older than this are not shown as "Listing Approved". */
const RECENT_APPROVAL_WINDOW_MS = 14 * MS_DAY;

function withinWindow(ts, windowMs, nowMs = Date.now()) {
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= windowMs;
}

/**
 * Derive recent operational activity from listing rows (newest first).
 * Omits stale live / draft / upgrade noise — only meaningful lifecycle events.
 */
export function buildAgentActivityFeed(listings, { limit = 16, nowMs = Date.now() } = {}) {
  const primary = [];

  for (const listing of listings || []) {
    const id = listing?.id;
    if (id == null) continue;
    const lc = getLifecycleStatus(listing);
    const ts = parseTs(listing) || nowMs;
    const title = String(listing?.title || "Listing").slice(0, 72);

    let row = null;
    if (lc === LISTING_LIFECYCLE.REJECTED && withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Rejected",
        detail: title,
        tone: "rejected",
      };
    } else if (
      lc === LISTING_LIFECYCLE.PENDING_REVIEW &&
      withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)
    ) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Pending Review",
        detail: title,
        tone: "pending",
      };
    } else if (lc === LISTING_LIFECYCLE.ARCHIVED && withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)) {
      const autoArchived = Boolean(
        listing?.archived_reason ||
          listing?.auto_archived ||
          listing?.closed_at ||
          listing?.sold_at ||
          listing?.rented_at
      );
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: autoArchived ? "Listing Auto Archived" : "Listing Archived",
        detail: title,
        tone: "archived",
      };
    } else if (
      (lc === LISTING_LIFECYCLE.SOLD || lc === LISTING_LIFECYCLE.RECENTLY_SOLD) &&
      withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)
    ) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Sold",
        detail: title,
        tone: "approved",
      };
    } else if (
      (lc === LISTING_LIFECYCLE.RENTED || lc === LISTING_LIFECYCLE.RECENTLY_RENTED) &&
      withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)
    ) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Rented",
        detail: title,
        tone: "approved",
      };
    } else if (lc === LISTING_LIFECYCLE.PUBLISHED && withinWindow(ts, RECENT_APPROVAL_WINDOW_MS, nowMs)) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Approved",
        detail: title,
        tone: "approved",
      };
    } else if (lc === LISTING_LIFECYCLE.EXPIRED && withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)) {
      row = {
        id: `feed-${id}`,
        listingId: id,
        ts,
        eventType: AGENT_FEED_EVENT.LIFECYCLE,
        headline: "Listing Expiring Soon",
        detail: title,
        tone: "health",
      };
    }

    if (row) primary.push(row);
  }

  primary.sort((a, b) => b.ts - a.ts);
  return primary.slice(0, limit);
}

/**
 * Merge inquiry leads into operational activity (newest first).
 */
export function mergeActivityWithInquiries(feedItems, inquiries, { limit = 18, nowMs = Date.now() } = {}) {
  const inquiryRows = [];
  for (const q of inquiries || []) {
    const id = q?.id;
    if (id == null) continue;
    const status = String(q.status || "").toLowerCase();
    const isReplied = status === "responded" || status === "closed";
    const tsRaw = isReplied ? q.updated_at || q.created_at : q.created_at || q.updated_at;
    const ts = tsRaw ? new Date(tsRaw).getTime() : nowMs;
    if (!withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)) continue;
    inquiryRows.push({
      id: `inq-${id}`,
      listingId: q.listing_id,
      ts,
      eventType: "inquiry",
      headline: isReplied ? "Inquiry Replied" : "New Inquiry",
      detail: String(q.body || "Buyer message").slice(0, 96),
      tone: isReplied ? "approved" : "pending",
    });
  }

  const merged = [...inquiryRows, ...(feedItems || [])];
  merged.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return merged.slice(0, limit);
}

/**
 * Merge viewing request status into operational activity (newest first).
 */
export function mergeActivityWithViewings(feedItems, viewings, { limit = 18, nowMs = Date.now() } = {}) {
  const viewingRows = [];
  for (const v of viewings || []) {
    const id = v?.id;
    if (id == null) continue;
    const status = String(v.status || "").toLowerCase();
    const tsRaw = v.updated_at || v.confirmed_at || v.created_at;
    const ts = tsRaw ? new Date(tsRaw).getTime() : nowMs;
    if (!withinWindow(ts, RECENT_ACTIVITY_WINDOW_MS, nowMs)) continue;

    let headline = null;
    let tone = "pending";
    if (status === "pending" || status === "requested") {
      headline = "Viewing Requested";
      tone = "pending";
    } else if (status === "confirmed") {
      headline = "Viewing Confirmed";
      tone = "approved";
    } else if (status === "rescheduled") {
      headline = "Viewing Rescheduled";
      tone = "pending";
    } else if (status === "cancelled" || status === "declined") {
      headline = "Viewing Cancelled";
      tone = "archived";
    } else {
      continue;
    }

    viewingRows.push({
      id: `view-${id}`,
      listingId: v.listing_id,
      ts,
      eventType: "viewing",
      headline,
      detail: String(v.requester_name || v.requester_email || "Buyer viewing").slice(0, 96),
      tone,
    });
  }

  const merged = [...viewingRows, ...(feedItems || [])];
  merged.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return merged.slice(0, limit);
}
