/**
 * Curated copy + metric keys for `/dashboard/user`.
 */
import { resolveActiveListingCapForTier } from "@/constants/operationalModel";
import {
  BL_ENABLE_CONVERSATIONS,
  BL_ENABLE_INQUIRIES,
  BL_ENABLE_VIEWING_PERSIST,
} from "@/lib/featureFlags";

export const USER_DASHBOARD_TAB_IDS = Object.freeze({
  OVERVIEW: "overview",
  MY_LISTINGS: "my-listings",
  PENDING: "pending",
  ARCHIVED: "archived",
  SAVED_FAVORITES: "saved-favorites",
  PROFILE: "profile",
  /** Unified inbox — buyer messages + owner listing inquiries */
  INBOX: "inbox",
  /** Unified viewing management — requests through completion */
  VIEWINGS: "viewings",
  /** @deprecated use VIEWINGS */
  VIEWING_REQUESTS: "viewing-requests",
  /** @deprecated use INBOX */
  MESSAGES: "messages",
  MY_INQUIRIES: "my-inquiries",
  /** @deprecated use VIEWINGS */
  MY_VIEWINGS: "my-viewings",
  /** @deprecated use INBOX */
  OWNER_INBOX: "owner-inbox",
  /** @deprecated use VIEWINGS */
  OWNER_VIEWINGS: "owner-viewings",
});

const LEGACY_TAB_ALIASES = Object.freeze({
  [USER_DASHBOARD_TAB_IDS.MESSAGES]: USER_DASHBOARD_TAB_IDS.INBOX,
  [USER_DASHBOARD_TAB_IDS.OWNER_INBOX]: USER_DASHBOARD_TAB_IDS.INBOX,
  [USER_DASHBOARD_TAB_IDS.MY_VIEWINGS]: USER_DASHBOARD_TAB_IDS.VIEWINGS,
  [USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS]: USER_DASHBOARD_TAB_IDS.VIEWINGS,
  [USER_DASHBOARD_TAB_IDS.VIEWING_REQUESTS]: USER_DASHBOARD_TAB_IDS.VIEWINGS,
});

/** Shared tab metadata for `/dashboard/user`. */
export const USER_DASHBOARD_TABS = Object.freeze([
  { id: USER_DASHBOARD_TAB_IDS.OVERVIEW, label: "Overview", group: "workspace" },
  { id: USER_DASHBOARD_TAB_IDS.MY_LISTINGS, label: "My Listings", group: "workspace" },
  { id: USER_DASHBOARD_TAB_IDS.PENDING, label: "Pending", group: "workspace" },
  { id: USER_DASHBOARD_TAB_IDS.ARCHIVED, label: "Archived", group: "workspace" },
  { id: USER_DASHBOARD_TAB_IDS.SAVED_FAVORITES, label: "Saved Favorites", group: "workspace" },
  { id: USER_DASHBOARD_TAB_IDS.PROFILE, label: "Profile", group: "workspace" },
  {
    id: USER_DASHBOARD_TAB_IDS.INBOX,
    label: "Inbox",
    group: "activity",
    crm: true,
    conversations: true,
  },
  {
    id: USER_DASHBOARD_TAB_IDS.VIEWINGS,
    label: "Viewings",
    group: "activity",
    crm: true,
    viewing: true,
  },
]);

const USER_TAB_SET = new Set([
  ...Object.values(USER_DASHBOARD_TAB_IDS),
  ...Object.keys(LEGACY_TAB_ALIASES),
]);

export function normalizeUserDashboardTab(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();
  if (!s) return USER_DASHBOARD_TAB_IDS.OVERVIEW;
  const canonical = LEGACY_TAB_ALIASES[s] || s;
  return USER_TAB_SET.has(s) || USER_TAB_SET.has(canonical)
    ? canonical
    : USER_DASHBOARD_TAB_IDS.OVERVIEW;
}

export function userHasOwnedListings({
  activeListings = 0,
  pendingListings = 0,
  archivedListings = 0,
  draftListings = 0,
  rejectedListings = 0,
} = {}) {
  return (
    activeListings + pendingListings + archivedListings + draftListings + rejectedListings > 0
  );
}

/** Buyer + owner CRM tabs for `/dashboard/user`. */
export function getVisibleUserDashboardTabs({ hasOwnedListings: _hasOwnedListings = false } = {}) {
  const crmTabsEnabled = BL_ENABLE_INQUIRIES || BL_ENABLE_CONVERSATIONS || BL_ENABLE_VIEWING_PERSIST;

  return USER_DASHBOARD_TABS.filter((tab) => {
    if (!tab.crm) return true;
    if (!crmTabsEnabled) return false;
    if (tab.conversations && !BL_ENABLE_CONVERSATIONS) return false;
    if (
      tab.id === USER_DASHBOARD_TAB_IDS.VIEWINGS &&
      !BL_ENABLE_VIEWING_PERSIST &&
      !BL_ENABLE_CONVERSATIONS
    ) {
      return false;
    }
    return true;
  });
}

export function resolveVisibleUserDashboardTab(
  raw,
  visibleTabs = getVisibleUserDashboardTabs()
) {
  const normalized = normalizeUserDashboardTab(raw);
  const visibleIds = new Set(visibleTabs.map((tab) => tab.id));
  if (visibleIds.has(normalized)) return normalized;
  return visibleTabs[0]?.id ?? USER_DASHBOARD_TAB_IDS.OVERVIEW;
}

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
  { key: "inbox", title: "Inbox", hint: "A calm inbox for conversations around your saved homes and listings." },
  { key: "appointments", title: "Appointment Requests", hint: "Schedule tours when this channel opens." },
]);

export const USER_DASHBOARD_FINITE_CAP_THRESHOLD = 512;

export function resolveUserDashboardListingCap(tier) {
  const quotaCap = resolveActiveListingCapForTier(tier);
  return quotaCap != null ? quotaCap : 99999;
}

export function formatListingRemainingLabel(remaining) {
  const n = Math.max(0, Math.floor(Number(remaining) || 0));
  return `${n} Remaining`;
}

export function formatTryCreateRemainderChip(remaining, cap) {
  if (cap >= USER_DASHBOARD_FINITE_CAP_THRESHOLD) return "";
  const n = Math.max(0, Math.floor(Number(remaining) || 0));
  return `(${n} remaining)`;
}
