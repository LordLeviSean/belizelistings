import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";

/**
 * Role-aware CRM dashboard path (buyer vs owner surfaces).
 * Admin keeps marketplace buyer + owner tabs on /admin.
 */
export function resolveDashboardCrmPath({
  role,
  tab,
  conversationId,
  viewingId,
} = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const base =
    normalizedRole === "admin"
      ? "/admin"
      : normalizedRole === "agent"
        ? "/dashboard/agent"
        : "/dashboard/user";

  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (conversationId) params.set("conversation", String(conversationId));
  if (viewingId) params.set("viewing", String(viewingId));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** After a buyer sends a listing message, open the correct inbox tab. */
export function resolvePostInquiryMessagesPath({ role, conversationId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  const tab =
    normalizedRole === "admin"
      ? ADMIN_DASHBOARD_TAB_IDS.MESSAGES
      : USER_DASHBOARD_TAB_IDS.MESSAGES;

  return resolveDashboardCrmPath({ role: normalizedRole, tab, conversationId });
}

/** Owner/agent notification deep links for new inquiry or viewing request. */
export function resolveOwnerInboxPath({ role, tab, conversationId, viewingId } = {}) {
  const normalizedRole = String(role || "user").trim().toLowerCase();

  if (normalizedRole === "admin") {
    return resolveDashboardCrmPath({
      role,
      tab: tab || ADMIN_DASHBOARD_TAB_IDS.OWNER_INBOX,
      conversationId,
      viewingId,
    });
  }

  if (normalizedRole === "agent") {
    return resolveDashboardCrmPath({
      role,
      tab: tab || AGENT_DASHBOARD_TAB_IDS.INQUIRIES,
      conversationId,
      viewingId,
    });
  }

  const userOwnerTab =
    tab === "viewings" || tab === AGENT_DASHBOARD_TAB_IDS.VIEWINGS
      ? USER_DASHBOARD_TAB_IDS.OWNER_VIEWINGS
      : tab || USER_DASHBOARD_TAB_IDS.OWNER_INBOX;

  return resolveDashboardCrmPath({
    role,
    tab: userOwnerTab,
    conversationId,
    viewingId,
  });
}
