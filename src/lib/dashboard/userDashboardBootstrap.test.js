/** @jest-environment jsdom */

import {
  readUserDashboardQueryParam,
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
    expect(shouldShowUserDashboardLoadingShell("pending")).toBe(true);
    expect(shouldShowUserDashboardLoadingShell("redirect-login")).toBe(true);
    expect(shouldShowUserDashboardLoadingShell("ready")).toBe(false);
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

  test("direct viewings deep link resolves tab and viewing id after hydration delay", () => {
    const router = {
      isReady: true,
      query: { tab: "viewings", viewing: "108" },
    };

    expect(readUserDashboardQueryParam(router, "viewing")).toBe("108");
    expect(resolveUserDashboardLocationQuery(router)).toEqual({
      tab: "viewings",
      viewing: "108",
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
