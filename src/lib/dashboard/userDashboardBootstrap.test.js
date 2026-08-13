/** @jest-environment jsdom */

import {
  readUserDashboardQueryParam,
  readPersistedViewingIntent,
  resolveUserDashboardLocationQuery,
  resolveUserDashboardSessionPhase,
  shouldShowUserDashboardLoadingShell,
} from "./userDashboardBootstrap";

describe("userDashboardBootstrap", () => {
  test("resolveUserDashboardSessionPhase waits for auth and router readiness", () => {
    expect(
      resolveUserDashboardSessionPhase({
        loading: true,
        user: { id: "u1" },
        role: "user",
        routerReady: true,
      })
    ).toBe("pending");

    expect(
      resolveUserDashboardSessionPhase({
        loading: false,
        user: { id: "u1" },
        role: "user",
        routerReady: false,
      })
    ).toBe("pending");

    expect(
      resolveUserDashboardSessionPhase({
        loading: false,
        user: { id: "u1" },
        role: "user",
        routerReady: true,
      })
    ).toBe("ready");
  });

  test("resolveUserDashboardSessionPhase redirects safely after bootstrap", () => {
    expect(
      resolveUserDashboardSessionPhase({
        loading: false,
        user: null,
        role: "user",
        routerReady: true,
      })
    ).toBe("redirect-login");

    expect(
      resolveUserDashboardSessionPhase({
        loading: false,
        user: { id: "u1" },
        role: "agent",
        routerReady: true,
      })
    ).toBe("redirect-dashboard");
  });

  test("shouldShowUserDashboardLoadingShell covers pending and redirect phases", () => {
    const {
      DASHBOARD_BOOTSTRAP_PHASE,
    } = require("./dashboardIntent");

    expect(
      shouldShowUserDashboardLoadingShell(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING)
    ).toBe(true);
    expect(
      shouldShowUserDashboardLoadingShell(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN)
    ).toBe(true);
    expect(shouldShowUserDashboardLoadingShell(DASHBOARD_BOOTSTRAP_PHASE.READY)).toBe(
      false
    );
  });

  test("readUserDashboardQueryParam preserves viewing deep link before router.isReady", () => {
    window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=42");

    expect(
      readUserDashboardQueryParam(
        { isReady: false, query: {} },
        "viewing"
      )
    ).toBe("42");

    expect(
      resolveUserDashboardLocationQuery({ isReady: false, query: {} })
    ).toEqual({
      tab: "viewings",
      conversation: undefined,
      viewing: "42",
      listing: undefined,
    });

    window.history.pushState({}, "", "/");
  });

  test("readUserDashboardQueryParam falls back to live URL when router query is empty", () => {
    window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=108");

    expect(
      readUserDashboardQueryParam({ isReady: true, query: {} }, "viewing")
    ).toBe("108");

    window.history.pushState({}, "", "/");
  });

  test("readPersistedViewingIntent survives intermediate rerenders", () => {
    const intentRef = { current: null };
    window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=55");

    expect(readPersistedViewingIntent(intentRef, { isReady: true, query: {} })).toBe("55");
    expect(readPersistedViewingIntent(intentRef, { isReady: true, query: {} })).toBe("55");

    window.history.pushState({}, "", "/");
  });

  test("direct viewings deep link resolves tab and viewing id after hydration delay", () => {
    const router = {
      isReady: true,
      query: { tab: "viewings", viewing: "108" },
    };

    expect(readUserDashboardQueryParam(router, "viewing")).toBe("108");
    expect(resolveUserDashboardLocationQuery(router)).toEqual({
      tab: "viewings",
      viewing: "108",
      conversation: undefined,
      listing: undefined,
    });
    expect(
      resolveUserDashboardSessionPhase({
        loading: false,
        user: { id: "buyer-1" },
        role: "user",
        routerReady: true,
      })
    ).toBe("ready");
  });
});
