/**
 * Cross-page sync for the user dashboard: metrics + My Listings refetch without
 * relying on missed Supabase realtime (subscription not active on /dashboard/create)
 * or fragile timing around client navigation.
 */
export const BL_USER_DASHBOARD_METRICS_EVENT = "bl-user-dashboard-metrics";

export function emitUserDashboardMetricsInvalidation(userId) {
  if (typeof window === "undefined" || userId == null || userId === "") return;
  const id = String(userId);
  window.dispatchEvent(new CustomEvent(BL_USER_DASHBOARD_METRICS_EVENT, { detail: { userId: id } }));
}

/**
 * After `router.push` to `/dashboard/user`, listeners mount in the same tick as
 * navigation completion. Defer one frame so `user.jsx` / `UserMyListingsPanel`
 * effects have registered.
 */
export function emitUserDashboardMetricsInvalidationAfterNavigation(userId) {
  if (typeof window === "undefined" || userId == null || userId === "") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      emitUserDashboardMetricsInvalidation(userId);
    });
  });
}
