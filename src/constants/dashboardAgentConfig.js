/**
 * Curated copy + navigation for `/dashboard/agent`.
 * Tier caps: `listingTierCaps.js` via `resolveUserDashboardListingCap`.
 */
import { AGENT_ACTIVE_LISTING_CAP } from "@/constants/listingTierCaps";
import { resolveUserDashboardListingCap, formatListingRemainingLabel, USER_DASHBOARD_FINITE_CAP_THRESHOLD } from "@/constants/dashboardUserConfig";

export { resolveUserDashboardListingCap, formatListingRemainingLabel };

export const AGENT_DASHBOARD_TAB_IDS = Object.freeze({
  OVERVIEW: "overview",
  LISTINGS: "listings",
  INQUIRIES: "inquiries",
  VIEWINGS: "viewings",
  PROFILE: "profile",
});

export const AGENT_DASHBOARD_TABS = Object.freeze([
  { id: AGENT_DASHBOARD_TAB_IDS.OVERVIEW, label: "Overview" },
  { id: AGENT_DASHBOARD_TAB_IDS.LISTINGS, label: "Listings" },
  { id: AGENT_DASHBOARD_TAB_IDS.INQUIRIES, label: "Inquiries" },
  { id: AGENT_DASHBOARD_TAB_IDS.VIEWINGS, label: "Viewings", crm: true },
  { id: AGENT_DASHBOARD_TAB_IDS.PROFILE, label: "Profile" },
]);

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
  listingLimitSubtext: "Active listing slots on your Agent tier",
  benefitsHeadline: "Your Agent Benefits",
  activityHeadline: "Recent activity",
  welcomeModalTitle: "Welcome to BelizeListings Agent",
  welcomeModalSubtext:
    "Your upgrade is approved. You now have access to professional listing tools and a public agent profile.",
});

export const AGENT_BENEFITS = Object.freeze([
  `Up to ${AGENT_ACTIVE_LISTING_CAP} active listings`,
  "Public agent profile",
  "Inquiry inbox",
  "Editorial review and trust signals",
]);

export const AGENT_WELCOME_STORAGE_KEY = "bl_agent_welcome_seen_v1";

export { USER_DASHBOARD_FINITE_CAP_THRESHOLD };
