/**
 * Curated copy + navigation for `/dashboard/agent`.
 * Tier caps: `listingTierCaps.js` via `resolveUserDashboardListingCap`.
 */
import { AGENT_ACTIVE_LISTING_CAP } from "@/constants/listingTierCaps";
import { resolveUserDashboardListingCap, formatListingRemainingLabel, USER_DASHBOARD_FINITE_CAP_THRESHOLD } from "@/constants/dashboardUserConfig";

export {
  resolveUserDashboardListingCap,
  formatListingRemainingLabel,
};

/**
 * Shown when an agent exhausts their active listing quota.
 * @param {number} listingCap from `resolveUserDashboardListingCap`
 */
export function formatAgentListingLimitExhaustedMessage(listingCap) {
  const cap = Math.max(0, Math.floor(Number(listingCap) || 0));
  return `You have reached the maximum of ${cap} active listings for your account. Please archive, rent, or sell an existing listing before publishing another.`;
}

export const AGENT_DASHBOARD_TAB_IDS = Object.freeze({
  OVERVIEW: "overview",
  LISTINGS: "listings",
  INBOX: "inbox",
  VIEWINGS: "viewings",
  PROFILE: "profile",
  /** @deprecated */
  INQUIRIES: "inquiries",
  /** @deprecated use VIEWINGS */
  VIEWING_REQUESTS: "viewing-requests",
});

const LEGACY_AGENT_TAB_ALIASES = Object.freeze({
  [AGENT_DASHBOARD_TAB_IDS.INQUIRIES]: AGENT_DASHBOARD_TAB_IDS.INBOX,
  [AGENT_DASHBOARD_TAB_IDS.VIEWING_REQUESTS]: AGENT_DASHBOARD_TAB_IDS.VIEWINGS,
});

export const AGENT_DASHBOARD_TABS = Object.freeze([
  { id: AGENT_DASHBOARD_TAB_IDS.OVERVIEW, label: "Overview", group: "workspace" },
  { id: AGENT_DASHBOARD_TAB_IDS.LISTINGS, label: "Listings", group: "workspace" },
  { id: AGENT_DASHBOARD_TAB_IDS.INBOX, label: "Inbox", group: "activity", crm: true },
  { id: AGENT_DASHBOARD_TAB_IDS.VIEWINGS, label: "Viewings", group: "activity", crm: true },
  { id: AGENT_DASHBOARD_TAB_IDS.PROFILE, label: "Profile", group: "workspace" },
]);

export function normalizeAgentDashboardTab(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();
  if (!s) return AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
  const canonical = LEGACY_AGENT_TAB_ALIASES[s] || s;
  const valid = new Set([...Object.values(AGENT_DASHBOARD_TAB_IDS), ...Object.keys(LEGACY_AGENT_TAB_ALIASES)]);
  return valid.has(s) || valid.has(canonical) ? canonical : AGENT_DASHBOARD_TAB_IDS.OVERVIEW;
}

export const AGENT_INVENTORY_FILTERS = Object.freeze({
  ALL: "all",
  ACTIVE: "active",
  PENDING: "pending",
  REJECTED: "rejected",
  ARCHIVED: "archived",
  DRAFTS: "drafts",
});

export const AGENT_INVENTORY_FILTER_OPTIONS = Object.freeze([
  { label: "All", value: AGENT_INVENTORY_FILTERS.ALL },
  { label: "Active", value: AGENT_INVENTORY_FILTERS.ACTIVE },
  { label: "Pending", value: AGENT_INVENTORY_FILTERS.PENDING },
  { label: "Rejected", value: AGENT_INVENTORY_FILTERS.REJECTED },
  { label: "Archived", value: AGENT_INVENTORY_FILTERS.ARCHIVED },
  { label: "Drafts", value: AGENT_INVENTORY_FILTERS.DRAFTS },
]);

export const AGENT_DASHBOARD_COPY = Object.freeze({
  shellTitle: "Agent Dashboard",
  shellSubtitle:
    "Manage listings, inquiries, visibility, and publishing from one calm workspace.",
  actionHeadline: "Ready to publish?",
  actionSubtext: "Create a listing when you are ready — drafts stay in the Listings tab.",
  primaryCta: "Create Listing",
  listingLimitPanelLabel: "Active listing capacity",
  listingLimitSubtext: "Active listing slots on your Agent tier",
  listingLimitExhaustedHint:
    "Archive, sell, or rent a listing to free a slot before publishing another.",
  benefitsHeadline: "Agent Tools",
  benefitsSubtext: "Professional capabilities on your Agent account.",
  activityHeadline: "Recent Activity",
  quickActionsTitle: "Quick Actions",
  quickActionCreateListing: "Create Listing",
  quickActionViewPublicProfile: "View Public Profile",
  quickActionEditProfile: "Edit Profile",
  quickActionViewInbox: "View Inbox",
  quickActionViewViewings: "View Viewings",
  quickActionBrowseMarketplace: "Browse Marketplace",
  welcomeModalTitle: "Welcome to BelizeListings Agent",
  welcomeModalSubtext:
    "Your upgrade is approved. You now have access to professional listing tools and a public agent profile.",
});

export const AGENT_BENEFITS = Object.freeze([
  `Up to ${AGENT_ACTIVE_LISTING_CAP} active listings`,
  "Public Agent Profile",
  "CRM Inbox",
  "Viewing Management",
  "Trust & Verification Signals",
  "Featured Listings (when available)",
]);

export const AGENT_WELCOME_STORAGE_KEY = "bl_agent_welcome_seen_v1";

export { USER_DASHBOARD_FINITE_CAP_THRESHOLD };
