import {
  Archive,
  BadgeCheck,
  Camera,
  CircleDot,
  FileText,
  Home,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { LISTING_EVENT_TYPES } from "./listingEventTypes";

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

function formatEventPrice(price, currency = "USD") {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString()} ${String(currency || "USD").trim()}`.trim();
}

function readPayloadPrice(payload = {}, key) {
  const block = payload?.[key];
  if (block && typeof block === "object") {
    return formatEventPrice(block.price, block.currency);
  }
  return null;
}

function humanizeEventType(eventType) {
  const slug = String(eventType || "")
    .replace(/^listing\./, "")
    .trim();
  if (!slug) return "Listing updated";
  return slug
    .split(/[._]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Relative time label for timeline rows (public-facing).
 * @param {string|number|Date} occurredAt
 * @param {number} [nowMs=Date.now()]
 */
export function formatListingEventRelativeTime(occurredAt, nowMs = Date.now()) {
  const ts = new Date(occurredAt).getTime();
  if (!Number.isFinite(ts)) return "";

  const diffMs = Math.max(0, nowMs - ts);
  const diffMinutes = Math.floor(diffMs / MS_MINUTE);
  const diffHours = Math.floor(diffMs / MS_HOUR);
  const diffDays = Math.floor(diffMs / MS_DAY);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DEFAULT_PRESENTATION = {
  icon: CircleDot,
  buildHeadline: (event) => humanizeEventType(event?.event_type),
  buildDescription: (event) => {
    const note = event?.payload?.note;
    return note ? String(note) : null;
  },
};

/** Central registry: event_type → presentation builders. */
export const LISTING_EVENT_PRESENTATION = Object.freeze({
  [LISTING_EVENT_TYPES.PUBLISHED]: {
    icon: Home,
    buildHeadline: () => "Listed on BelizeListings",
    buildDescription: (event) => {
      const status = event?.payload?.lifecycle_status;
      return status ? `Status: ${String(status).replace(/_/g, " ")}` : null;
    },
  },
  [LISTING_EVENT_TYPES.VERIFICATION_APPROVED]: {
    icon: BadgeCheck,
    buildHeadline: () => "Verified by BelizeListings",
    buildDescription: (event) => {
      const verifiedAt = event?.payload?.verified_at;
      if (!verifiedAt) return null;
      return `Verified on ${new Date(verifiedAt).toLocaleDateString()}`;
    },
  },
  [LISTING_EVENT_TYPES.PRICE_REDUCED]: {
    icon: TrendingDown,
    buildHeadline: (event) => {
      const to = readPayloadPrice(event?.payload, "to");
      return to ? `Price reduced to ${to}` : "Price reduced";
    },
    buildDescription: (event) => {
      const from = readPayloadPrice(event?.payload, "from");
      return from ? `Previously ${from}` : null;
    },
  },
  [LISTING_EVENT_TYPES.PRICE_INCREASED]: {
    icon: TrendingUp,
    buildHeadline: (event) => {
      const to = readPayloadPrice(event?.payload, "to");
      return to ? `Price increased to ${to}` : "Price increased";
    },
    buildDescription: (event) => {
      const from = readPayloadPrice(event?.payload, "from");
      return from ? `Previously ${from}` : null;
    },
  },
  [LISTING_EVENT_TYPES.PHOTOS_UPDATED]: {
    icon: Camera,
    buildHeadline: () => "Photos updated",
    buildDescription: (event) => {
      const count = event?.payload?.photo_count;
      if (count == null) return null;
      const n = Number(count);
      if (!Number.isFinite(n)) return null;
      return `${n} photo${n === 1 ? "" : "s"} on listing`;
    },
  },
  [LISTING_EVENT_TYPES.DESCRIPTION_UPDATED]: {
    icon: FileText,
    buildHeadline: () => "Description updated",
    buildDescription: () => null,
  },
  [LISTING_EVENT_TYPES.ARCHIVED]: {
    icon: Archive,
    buildHeadline: () => "Listing archived",
    buildDescription: () => null,
  },
  [LISTING_EVENT_TYPES.REPUBLISHED]: {
    icon: RotateCcw,
    buildHeadline: () => "Back on market",
    buildDescription: () => "Listing republished on BelizeListings",
  },
  [LISTING_EVENT_TYPES.SOLD]: {
    icon: Tag,
    buildHeadline: () => "Marked as sold",
    buildDescription: () => null,
  },
  [LISTING_EVENT_TYPES.RENTED]: {
    icon: KeyRound,
    buildHeadline: () => "Marked as rented",
    buildDescription: () => null,
  },
  [LISTING_EVENT_TYPES.UNDER_CONTRACT]: {
    icon: RefreshCw,
    buildHeadline: () => "Under contract",
    buildDescription: () => null,
  },
  [LISTING_EVENT_TYPES.STATUS_CHANGED]: {
    icon: RefreshCw,
    buildHeadline: (event) => {
      const to = event?.payload?.to_status;
      return to ? `Status changed to ${String(to).replace(/_/g, " ")}` : "Listing status updated";
    },
    buildDescription: (event) => {
      const from = event?.payload?.from_status;
      return from ? `Previously ${String(from).replace(/_/g, " ")}` : null;
    },
  },
});

/**
 * Resolve UI copy + icon for a listing_events row.
 * @param {object} event
 * @returns {{ icon: import('lucide-react').LucideIcon, headline: string, description: string|null, relativeTime: string }}
 */
export function presentListingEvent(event, { nowMs = Date.now() } = {}) {
  const config = LISTING_EVENT_PRESENTATION[event?.event_type] || DEFAULT_PRESENTATION;
  return {
    icon: config.icon || DEFAULT_PRESENTATION.icon,
    headline: config.buildHeadline(event),
    description: config.buildDescription?.(event) ?? null,
    relativeTime: formatListingEventRelativeTime(event?.occurred_at, nowMs),
  };
}
