/** @jest-environment node */

import {
  DASHBOARD_BOOTSTRAP_PHASE,
  resolveDashboardBootstrapPhase,
  resolveDashboardTabFromIntent,
} from "../dashboard/dashboardIntent";
import {
  ADMIN_DASHBOARD_TAB_IDS,
  resolveVisibleAdminDashboardTab,
} from "../../constants/dashboardAdminConfig";
import { resolveAdminDashboardTabFromQuery } from "../dashboardCrmRoutes";
import {
  buildProtectedLoginHref,
  shouldAcknowledgeProtectedEntry,
} from "../auth/protectedEntry";

const ADMIN_VISIBLE_TABS = [
  { id: ADMIN_DASHBOARD_TAB_IDS.PENDING },
  { id: ADMIN_DASHBOARD_TAB_IDS.INBOX },
  { id: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS },
];
const ADMIN_ENTITY_TAB_MAP = {
  viewing: ADMIN_DASHBOARD_TAB_IDS.VIEWINGS,
  conversation: ADMIN_DASHBOARD_TAB_IDS.INBOX,
  listing: ADMIN_DASHBOARD_TAB_IDS.LISTINGS,
};

describe("admin dashboard bootstrap contract", () => {
  test("waits for router before treating admin access as terminal", () => {
    expect(
      resolveDashboardBootstrapPhase({
        routerReady: false,
        loading: false,
        user: { id: "admin-1" },
        role: "admin",
        expectedRole: "admin",
        profileHydrated: true,
      })
    ).toBe(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING);
  });

  test("auth unresolved is not treated as logged out for admin", () => {
    expect(
      resolveDashboardBootstrapPhase({
        routerReady: true,
        loading: true,
        user: { id: "admin-1" },
        role: "admin",
        expectedRole: "admin",
        profileHydrated: true,
      })
    ).toBe(DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING);
  });

  test("admin access terminal false redirects to dashboard hub", () => {
    expect(
      resolveDashboardBootstrapPhase({
        routerReady: true,
        loading: false,
        user: { id: "user-1" },
        role: "user",
        expectedRole: "admin",
        profileHydrated: true,
      })
    ).toBe(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_DASHBOARD);
  });

  test("admin access terminal true reaches ready", () => {
    expect(
      resolveDashboardBootstrapPhase({
        routerReady: true,
        loading: false,
        user: { id: "admin-1" },
        role: "admin",
        expectedRole: "admin",
        profileHydrated: true,
      })
    ).toBe(DASHBOARD_BOOTSTRAP_PHASE.READY);
  });

  test("conversation param forces Inbox tab even when tab query is stale", () => {
    expect(
      resolveDashboardTabFromIntent({
        locationQuery: { tab: "pending", conversation: "4ad9a869-2107-4fcc-82cb-a0eccfe8b8c0" },
        inferTabFromQuery: resolveAdminDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleAdminDashboardTab,
        visibleTabs: ADMIN_VISIBLE_TABS,
        entityTabMap: ADMIN_ENTITY_TAB_MAP,
        defaultTab: ADMIN_DASHBOARD_TAB_IDS.PENDING,
      })
    ).toBe(ADMIN_DASHBOARD_TAB_IDS.INBOX);
  });

  test("viewing param forces Viewings tab even when tab query is stale", () => {
    expect(
      resolveDashboardTabFromIntent({
        locationQuery: { tab: "pending", viewing: "0378fa80-ac4c-48be-a138-7d63f77d5710" },
        inferTabFromQuery: resolveAdminDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleAdminDashboardTab,
        visibleTabs: ADMIN_VISIBLE_TABS,
        entityTabMap: ADMIN_ENTITY_TAB_MAP,
        defaultTab: ADMIN_DASHBOARD_TAB_IDS.PENDING,
      })
    ).toBe(ADMIN_DASHBOARD_TAB_IDS.VIEWINGS);
  });

  test("protected login href preserves admin conversation destination", () => {
    const href =
      "/admin?tab=inbox&conversation=4ad9a869-2107-4fcc-82cb-a0eccfe8b8c0";
    expect(buildProtectedLoginHref(href)).toContain(
      encodeURIComponent(href)
    );
  });

  test("Pass 6 acknowledges admin destination only after entity intent matches", () => {
    const destination =
      "/admin?tab=viewings&viewing=0378fa80-ac4c-48be-a138-7d63f77d5710";

    expect(
      shouldAcknowledgeProtectedEntry({
        pathname: "/admin",
        expectedRole: "admin",
        role: "admin",
        intent: { tab: "viewings", viewing: "0378fa80-ac4c-48be-a138-7d63f77d5710" },
        destinationHref: destination,
      })
    ).toBe(true);

    expect(
      shouldAcknowledgeProtectedEntry({
        pathname: "/admin",
        expectedRole: "admin",
        role: "admin",
        intent: { tab: "pending" },
        destinationHref: destination,
      })
    ).toBe(false);
  });
});
