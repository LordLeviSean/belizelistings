/**
 * Curated copy + metric keys for `/dashboard/user`.
 *
 * Tier caps: `listingTierCaps.js` (public 5, agent 25, brokerage 100; optional
 * `NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE` for QA).
 */
import { resolveActiveListingCapForTier } from "@/constants/operationalModel";

export const USER_DASHBOARD_TAB_IDS = Object.freeze({
  OVERVIEW: "overview",
  MY_LISTINGS: "my-listings",
  PENDING: "pending",
  ARCHIVED: "archived",
  SAVED_FAVORITES: "saved-favorites",
});

/** Shared tab metadata for `/dashboard/user`. */
export const USER_DASHBOARD_TABS = Object.freeze([
  { id: USER_DASHBOARD_TAB_IDS.OVERVIEW, label: "Overview" },
  { id: USER_DASHBOARD_TAB_IDS.MY_LISTINGS, label: "My Listings" },
  { id: USER_DASHBOARD_TAB_IDS.PENDING, label: "Pending" },
  { id: USER_DASHBOARD_TAB_IDS.ARCHIVED, label: "Archived" },
  { id: USER_DASHBOARD_TAB_IDS.SAVED_FAVORITES, label: "Saved Favorites" },
]);

export const USER_DASHBOARD_METRIC_KEYS = Object.freeze({
  ACTIVE_LISTINGS: "activeListings",
  PENDING_LISTINGS: "pendingListings",
  SAVED_FAVORITES: "savedFavorites",
  INQUIRIES: "inquiries",
  LISTING_LIMIT: "listingLimit",
  ARCHIVED: "archivedListings",
  DRAFT: "draftListings",
});

export const USER_ACCOUNT_ROLE_LABELS = Object.freeze({
  user: "Platform User",
  agent: "Agent",
  broker: "Broker",
});

export const USER_UPGRADE_PATHS = Object.freeze({
  AGENT: "agent",
  BROKER: "broker",
  DEVELOPER: "developer",
});

export const USER_DASHBOARD_COPY = Object.freeze({
  shellTitle: "User Control Center",
  actionHeadline: "Start building your Belize presence",
  actionSubtext: "Create listings, save properties, and explore districts across Belize.",
  tryCreateLead: "Try creating your own listing!",
  listingLimitSubtext: "Listings available on your current tier",
  upgradeHint:
    "You have ten active listings on your account. Become an Agent to create more listings and unlock professional tools.",
  upgradeCta: "Upgrade to Agent",
  upgradeToBrokerCta: "Upgrade to Broker",
  agentUpgradePendingLabel: "Agent upgrade request pending editorial review.",
  agentUpgradePendingCta: "Agent upgrade pending",
  accountTierHeadline: "Your account",
  accountTierSubtext: "Listing capacity and professional tools follow your BelizeListings role.",
  upgradePathHeadline: "What best describes you?",
  upgradePathSubtext:
    "Choose the path that fits — we route you to agent onboarding or brokerage verification when ready.",
  upgradeAgentLabel: "Independent Agent",
  upgradeAgentHint: "List more homes, manage inquiries, and build your Belize portfolio.",
  upgradeBrokerLabel: "Broker / Office",
  upgradeBrokerHint:
    "Team oversight and brokerage verification — we confirm office affiliation before unlocking broker tools.",
  upgradeDeveloperLabel: "Developer",
  upgradeDeveloperHint: "Project marketing and inventory tools — opening soon.",
  brokerVerificationNote:
    "Brokerage accounts require office verification. You can begin agent onboarding anytime; broker tools unlock after review.",
  primaryCta: "Create Listing",
  secondaryCta: "Saved Favorites",
  placeholderComingSoon: "Coming soon",
  inquiriesComingSoon: "Coming soon",
});

export const USER_DASHBOARD_PLACEHOLDERS = Object.freeze([
  { key: "messages", title: "Messages", hint: "A calm inbox for conversations around your saved homes." },
  { key: "appointments", title: "Appointment Requests", hint: "Schedule tours when this channel opens." },
]);

/** Above this cap we treat listing slots as unlimited for CTA disable + "(N remaining)" chip. */
export const USER_DASHBOARD_FINITE_CAP_THRESHOLD = 512;

/**
 * @param {string} tier from `useUserRole` / `resolveTierFromProfile`
 * @returns {number}
 */
export function resolveUserDashboardListingCap(tier) {
  const quotaCap = resolveActiveListingCapForTier(tier);
  return quotaCap != null ? quotaCap : 99999;
}

/**
 * @param {number} remaining
 * @returns {string} e.g. "5 Remaining"
 */
export function formatListingRemainingLabel(remaining) {
  const n = Math.max(0, Math.floor(Number(remaining) || 0));
  return `${n} Remaining`;
}

/**
 * @param {number} remaining
 * @param {number} cap
 * @returns {string}
 */
export function formatTryCreateRemainderChip(remaining, cap) {
  if (cap >= USER_DASHBOARD_FINITE_CAP_THRESHOLD) return "";
  const n = Math.max(0, Math.floor(Number(remaining) || 0));
  return `(${n} remaining)`;
}
