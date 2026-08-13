/**
 * @deprecated Import from `@/lib/dashboard/dashboardIntent` instead.
 * Thin re-export layer retained for existing imports during migration.
 */
import {
  DASHBOARD_BOOTSTRAP_PHASE,
  createDashboardIntentStore,
  readDashboardIntent,
  readDashboardQueryParam,
  resolveDashboardBootstrapPhase,
  resolveDashboardLocationQuery,
  shouldShowDashboardBootstrapShell,
} from "./dashboardIntent";

export {
  DASHBOARD_BOOTSTRAP_PHASE,
  DASHBOARD_ENTITY_PARAMS,
  DASHBOARD_QUERY_PARAMS,
  createDashboardIntentStore,
  dashboardBootstrapShellLabel,
  maybeClearStaleDashboardIntent,
  readDashboardIntent,
  readDashboardQueryParam as readUserDashboardQueryParam,
  resolveDashboardBootstrapPhase,
  resolveDashboardLocationQuery as resolveUserDashboardLocationQuery,
  resolveDashboardTabFromIntent,
  shouldRunDashboardRedirect,
  shouldShowDashboardBootstrapShell as shouldShowUserDashboardLoadingShell,
} from "./dashboardIntent";

/**
 * @deprecated Use `readDashboardIntent(intentStore, router).viewing` instead.
 * @param {{ current: object|string|null }} intentRef
 */
export function readPersistedViewingIntent(intentRef, router) {
  if (!intentRef?.current || typeof intentRef.current !== "object") {
    intentRef.current = createDashboardIntentStore();
    if (typeof intentRef.current === "string") {
      intentRef.current = { ...createDashboardIntentStore(), viewing: intentRef.current };
    }
  }
  return readDashboardIntent(intentRef.current, router).viewing;
}

/** @deprecated Use `resolveDashboardBootstrapPhase({ expectedRole: "user", ... })`. */
export function resolveUserDashboardSessionPhase({
  loading = false,
  user = null,
  role = "user",
  routerReady = true,
  profileHydrated = false,
} = {}) {
  const phase = resolveDashboardBootstrapPhase({
    loading,
    user,
    role,
    expectedRole: "user",
    routerReady,
    profileHydrated,
  });

  if (
    phase === DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING ||
    phase === DASHBOARD_BOOTSTRAP_PHASE.AUTH_PENDING
  ) {
    return "pending";
  }
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN) return "redirect-login";
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_DASHBOARD) return "redirect-dashboard";
  return "ready";
}
