import { ADMIN_DASHBOARD_TAB_IDS } from "@/constants/dashboardAdminConfig";
import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";

/** Role-aware listings destination for Geographic Update CTA (shared single implementation). */
export function resolveGeographicUpdateListingsHref(role) {
  const r = String(role || "user").toLowerCase();
  if (r === "admin") return `/admin?tab=${ADMIN_DASHBOARD_TAB_IDS.LISTINGS}`;
  if (r === "agent") return `/dashboard/agent?tab=${AGENT_DASHBOARD_TAB_IDS.LISTINGS}`;
  if (r === "operator") return `/admin?tab=${ADMIN_DASHBOARD_TAB_IDS.OPERATOR}`;
  return `/dashboard/user?tab=${USER_DASHBOARD_TAB_IDS.MY_LISTINGS}`;
}
