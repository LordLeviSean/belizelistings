import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";

/**
 * Role-aware exit targets from `/dashboard/create`.
 * @param {{ isAdmin?: boolean, isRegularUser?: boolean, role?: string }} access
 * @param {{ afterSubmit?: boolean }} [options]
 * @returns {string}
 */
export function resolveCreateWorkspaceDashboardHref(
  { isAdmin = false, isRegularUser = false, role = "" } = {},
  { afterSubmit = false } = {}
) {
  if (isAdmin) {
    return `/admin?tab=pending`;
  }
  if (isRegularUser) {
    const tab = afterSubmit
      ? USER_DASHBOARD_TAB_IDS.PENDING
      : USER_DASHBOARD_TAB_IDS.MY_LISTINGS;
    return `/dashboard/user?tab=${tab}`;
  }
  const normalized = String(role || "").trim().toLowerCase();
  if (
    normalized === "broker" ||
    normalized === "brokerage" ||
    normalized === "property_manager"
  ) {
    return "/dashboard/broker";
  }
  return "/dashboard/agent";
}
