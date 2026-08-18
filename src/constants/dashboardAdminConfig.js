import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_INQUIRIES, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";

export const ADMIN_DASHBOARD_TAB_IDS = Object.freeze({
  PENDING: "pending",
  LISTINGS: "listings",
  USERS: "users",
  OPERATOR: "operator",
  UPGRADES: "upgrades",
  INBOX: "inbox",
  VIEWINGS: "viewings",
  PROFILE: "profile",
  NOTIFICATIONS: "notifications",
  /** @deprecated use VIEWINGS */
  VIEWING_REQUESTS: "viewing-requests",
  /** @deprecated */
  MESSAGES: "messages",
  MY_INQUIRIES: "my-inquiries",
  /** @deprecated use VIEWINGS */
  MY_VIEWINGS: "my-viewings",
  /** @deprecated */
  OWNER_INBOX: "owner-inbox",
  /** @deprecated use VIEWINGS */
  OWNER_VIEWINGS: "owner-viewings",
});

const LEGACY_TAB_ALIASES = Object.freeze({
  [ADMIN_DASHBOARD_TAB_IDS.MESSAGES]: ADMIN_DASHBOARD_TAB_IDS.INBOX,
  [ADMIN_DASHBOARD_TAB_IDS.OWNER_INBOX]: ADMIN_DASHBOARD_TAB_IDS.INBOX,
  [ADMIN_DASHBOARD_TAB_IDS.MY_VIEWINGS]: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
  [ADMIN_DASHBOARD_TAB_IDS.OWNER_VIEWINGS]: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
  [ADMIN_DASHBOARD_TAB_IDS.VIEWING_REQUESTS]: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
});

export const ADMIN_DASHBOARD_TABS = Object.freeze([
  { id: ADMIN_DASHBOARD_TAB_IDS.PENDING, label: "Pending", group: "workspace", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.LISTINGS, label: "Listings", group: "workspace", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.USERS, label: "Users", group: "workspace", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.OPERATOR, label: "Operator", group: "workspace", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.UPGRADES, label: "Upgrades", group: "workspace", operational: true },
  { id: ADMIN_DASHBOARD_TAB_IDS.PROFILE, label: "Profile", group: "workspace", operational: true },
  {
    id: ADMIN_DASHBOARD_TAB_IDS.NOTIFICATIONS,
    label: "Notification Logs",
    group: "workspace",
    operational: true,
  },
  {
    id: ADMIN_DASHBOARD_TAB_IDS.INBOX,
    label: "Inbox",
    group: "activity",
    crm: true,
    conversations: true,
  },
  {
    id: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
    label: "Viewings",
    group: "activity",
    crm: true,
    viewing: true,
  },
]);

const ADMIN_TAB_SET = new Set([
  ...Object.values(ADMIN_DASHBOARD_TAB_IDS),
  ...Object.keys(LEGACY_TAB_ALIASES),
]);

export function normalizeAdminDashboardTab(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();
  if (!s) return ADMIN_DASHBOARD_TAB_IDS.PENDING;
  const canonical = LEGACY_TAB_ALIASES[s] || s;
  return ADMIN_TAB_SET.has(s) || ADMIN_TAB_SET.has(canonical)
    ? canonical
    : ADMIN_DASHBOARD_TAB_IDS.PENDING;
}

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
    if (!tab.crm) return true;
    if (!crmEnabled) return false;
    if (tab.conversations && !BL_ENABLE_CONVERSATIONS) return false;
    if (
      tab.id === ADMIN_DASHBOARD_TAB_IDS.VIEWINGS &&
      !BL_ENABLE_VIEWING_PERSIST &&
      !BL_ENABLE_CONVERSATIONS
    ) {
      return false;
    }
    return true;
  });
}
