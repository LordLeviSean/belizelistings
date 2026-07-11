import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";

export const ADMIN_DASHBOARD_TAB_IDS = Object.freeze({
  PENDING: "pending",
  LISTINGS: "listings",
  USERS: "users",
  OPERATOR: "operator",
  UPGRADES: "upgrades",
  MESSAGES: "messages",
  MY_INQUIRIES: "my-inquiries",
  MY_VIEWINGS: "my-viewings",
  OWNER_INBOX: "owner-inbox",
  OWNER_VIEWINGS: "owner-viewings",
});

/** Operational + marketplace CRM tabs for `/admin`. */
export const ADMIN_DASHBOARD_TABS = Object.freeze([
  { id: ADMIN_DASHBOARD_TAB_IDS.PENDING, label: "Pending", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.LISTINGS, label: "Listings", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.USERS, label: "Users", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.OPERATOR, label: "Operator", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.UPGRADES, label: "Upgrades", operational: true },
  {
    id: ADMIN_DASHBOARD_TAB_IDS.MESSAGES,
    label: "Messages",
    buyer: true,
    conversations: true,
  },
  { id: ADMIN_DASHBOARD_TAB_IDS.MY_INQUIRIES, label: "My Inquiries", buyer: true, crm: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.MY_VIEWINGS, label: "My Viewings", buyer: true, crm: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.OWNER_INBOX, label: "Owner Inbox", owner: true, conversations: true },
  {
    id: ADMIN_DASHBOARD_TAB_IDS.OWNER_VIEWINGS,
    label: "Viewing Requests",
    owner: true,
    crm: true,
  },
]);

const ADMIN_TAB_SET = new Set(Object.values(ADMIN_DASHBOARD_TAB_IDS));

export function normalizeAdminDashboardTab(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();
  return ADMIN_TAB_SET.has(s) ? s : ADMIN_DASHBOARD_TAB_IDS.PENDING;
}

/** Normalize tab id and ensure it is visible under current feature flags. */
export function resolveVisibleAdminDashboardTab(
  raw,
  visibleTabs = getVisibleAdminDashboardTabs()
) {
  const normalized = normalizeAdminDashboardTab(raw);
  const visibleIds = new Set(visibleTabs.map((tab) => tab.id));
  if (visibleIds.has(normalized)) return normalized;
  return visibleTabs[0]?.id ?? ADMIN_DASHBOARD_TAB_IDS.PENDING;
}

export function getVisibleAdminDashboardTabs() {
  const crmEnabled = BL_ENABLE_INQUIRIES || BL_ENABLE_CONVERSATIONS || BL_ENABLE_VIEWING_PERSIST;
  return ADMIN_DASHBOARD_TABS.filter((tab) => {
    if (tab.buyer || tab.owner) {
      if (!crmEnabled) return false;
      if (tab.conversations && !BL_ENABLE_CONVERSATIONS) return false;
      if (tab.id === ADMIN_DASHBOARD_TAB_IDS.MY_INQUIRIES) {
        if (!BL_ENABLE_INQUIRIES && !BL_ENABLE_CONVERSATIONS) return false;
        if (BL_ENABLE_CONVERSATIONS) return false;
      }
      if (
        (tab.id === ADMIN_DASHBOARD_TAB_IDS.MY_VIEWINGS ||
          tab.id === ADMIN_DASHBOARD_TAB_IDS.OWNER_VIEWINGS) &&
        !BL_ENABLE_VIEWING_PERSIST &&
        !BL_ENABLE_CONVERSATIONS
      ) {
        return false;
      }
    }
    return true;
  });
}
