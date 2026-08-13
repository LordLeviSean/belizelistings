/** @jest-environment jsdom */

import { AGENT_DASHBOARD_TAB_IDS } from "@/constants/dashboardAgentConfig";
import { USER_DASHBOARD_TAB_IDS } from "@/constants/dashboardUserConfig";
import { resolveAgentDashboardTabFromQuery } from "@/lib/dashboardCrmRoutes";
import { resolveUserDashboardTabFromQuery } from "@/lib/dashboardCrmRoutes";
import {
  DASHBOARD_BOOTSTRAP_PHASE,
  createDashboardIntentStore,
  dashboardBootstrapShellLabel,
  maybeClearStaleDashboardIntent,
  readDashboardIntent,
  readDashboardQueryParam,
  resolveDashboardBootstrapPhase,
  resolveDashboardLocationQuery,
  resolveDashboardTabFromIntent,
  shouldRunDashboardRedirect,
  shouldShowDashboardBootstrapShell,
} from "./dashboardIntent";

const USER_VISIBLE_TABS = [
  { id: USER_DASHBOARD_TAB_IDS.OVERVIEW },
  { id: USER_DASHBOARD_TAB_IDS.INBOX },
  { id: USER_DASHBOARD_TAB_IDS.VIEWINGS },
];

const AGENT_VISIBLE_TABS = [
  { id: AGENT_DASHBOARD_TAB_IDS.OVERVIEW },
  { id: AGENT_DASHBOARD_TAB_IDS.INBOX },
  { id: AGENT_DASHBOARD_TAB_IDS.VIEWINGS },
  { id: AGENT_DASHBOARD_TAB_IDS.LISTINGS },
];

function resolveVisibleUserTab(raw, tabs) {
  const normalized = String(raw || USER_DASHBOARD_TAB_IDS.OVERVIEW);
  const ids = new Set(tabs.map((t) => t.id));
  return ids.has(normalized) ? normalized : tabs[0].id;
}

function resolveVisibleAgentTab(raw, tabs) {
  const normalized = String(raw || AGENT_DASHBOARD_TAB_IDS.OVERVIEW);
  const ids = new Set(tabs.map((t) => t.id));
  return ids.has(normalized) ? normalized : tabs[0].id;
}

describe("dashboardIntent shared contract", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  describe("readDashboardQueryParam + resolveDashboardLocationQuery", () => {
    test("reads from live URL when router.isReady is false (user + agent)", () => {
      window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=42&conversation=c1");
      const router = { isReady: false, query: {} };

      expect(readDashboardQueryParam(router, "viewing")).toBe("42");
      expect(readDashboardQueryParam(router, "conversation")).toBe("c1");
      expect(resolveDashboardLocationQuery(router)).toMatchObject({
        tab: "viewings",
        viewing: "42",
        conversation: "c1",
      });

      window.history.pushState({}, "", "/dashboard/agent?tab=inbox&conversation=agent-conv");
      expect(readDashboardQueryParam(router, "conversation")).toBe("agent-conv");
    });

    test("falls back to live URL when router is ready but query is empty", () => {
      window.history.pushState({}, "", "/dashboard/user?viewing=108");
      expect(
        readDashboardQueryParam({ isReady: true, query: {} }, "viewing")
      ).toBe("108");
    });

    test("merges URL fallback into location query when router is ready but tab is missing", () => {
      window.history.pushState({}, "", "/dashboard/user?tab=profile");
      expect(
        resolveDashboardLocationQuery({ isReady: true, query: {} })
      ).toMatchObject({ tab: "profile" });
    });

    test("preserves unrelated router query fields when merging dashboard params", () => {
      window.history.pushState({}, "", "/dashboard/user?tab=profile");
      expect(
        resolveDashboardLocationQuery({
          isReady: true,
          query: { utm_source: "email" },
        })
      ).toMatchObject({ tab: "profile", utm_source: "email" });
    });
  });

  describe("readDashboardIntent persistence", () => {
    test("preserves viewing intent through intermediate rerenders", () => {
      const store = createDashboardIntentStore();
      window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=55");

      expect(readDashboardIntent(store, { isReady: true, query: {} }).viewing).toBe("55");
      expect(readDashboardIntent(store, { isReady: false, query: {} }).viewing).toBe("55");
    });

    test("preserves conversation intent through intermediate rerenders", () => {
      const store = createDashboardIntentStore();
      window.history.pushState({}, "", "/dashboard/agent?tab=inbox&conversation=abc-123");

      expect(readDashboardIntent(store, { isReady: true, query: {} }).conversation).toBe(
        "abc-123"
      );
      expect(readDashboardIntent(store, { isReady: false, query: {} }).conversation).toBe(
        "abc-123"
      );
    });

    test("does not clear entity intent while auth/router is temporarily unresolved", () => {
      const store = createDashboardIntentStore();
      window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=77");
      readDashboardIntent(store, { isReady: true, query: {} });

      window.history.pushState({}, "", "/dashboard/user?tab=viewings");
      const intent = readDashboardIntent(store, { isReady: false, query: {} });
      expect(intent.viewing).toBe("77");
    });

    test("clears stale intent only after leaving feature tab without URL param", () => {
      const store = createDashboardIntentStore();
      store.viewing = "99";
      const entityTabMap = { viewing: USER_DASHBOARD_TAB_IDS.VIEWINGS };

      maybeClearStaleDashboardIntent(store, {
        activeTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
        router: { isReady: true, query: {} },
        entityTabMap,
      });
      expect(store.viewing).toBeNull();

      store.viewing = "99";
      maybeClearStaleDashboardIntent(store, {
        activeTab: USER_DASHBOARD_TAB_IDS.VIEWINGS,
        router: { isReady: true, query: {} },
        entityTabMap,
      });
      expect(store.viewing).toBe("99");
    });
  });

  describe("resolveDashboardTabFromIntent", () => {
    test("forces viewings tab for user viewing deep link", () => {
      const tab = resolveDashboardTabFromIntent({
        locationQuery: { tab: "overview", viewing: "108" },
        inferTabFromQuery: resolveUserDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleUserTab,
        visibleTabs: USER_VISIBLE_TABS,
        entityTabMap: {
          viewing: USER_DASHBOARD_TAB_IDS.VIEWINGS,
          conversation: USER_DASHBOARD_TAB_IDS.INBOX,
        },
        defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
      });
      expect(tab).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
    });

    test("forces inbox tab for agent conversation deep link", () => {
      const tab = resolveDashboardTabFromIntent({
        locationQuery: { tab: "overview", conversation: "conv-1" },
        inferTabFromQuery: resolveAgentDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleAgentTab,
        visibleTabs: AGENT_VISIBLE_TABS,
        entityTabMap: {
          viewing: AGENT_DASHBOARD_TAB_IDS.VIEWINGS,
          conversation: AGENT_DASHBOARD_TAB_IDS.INBOX,
        },
        defaultTab: AGENT_DASHBOARD_TAB_IDS.OVERVIEW,
      });
      expect(tab).toBe(AGENT_DASHBOARD_TAB_IDS.INBOX);
    });

    describe("explicit location beats stale persisted store", () => {
      const entityTabMap = {
        viewing: USER_DASHBOARD_TAB_IDS.VIEWINGS,
        conversation: USER_DASHBOARD_TAB_IDS.INBOX,
        listing: USER_DASHBOARD_TAB_IDS.MY_LISTINGS,
      };

      test("viewing store → new conversation URL: conversation wins, inbox tab", () => {
        const store = createDashboardIntentStore();
        store.viewing = "55";
        window.history.pushState(
          {},
          "",
          "/dashboard/user?tab=inbox&conversation=abc123"
        );

        const locationQuery = resolveDashboardLocationQuery({
          isReady: true,
          query: { tab: "inbox", conversation: "abc123" },
        });
        readDashboardIntent(store, { isReady: true, query: locationQuery });

        expect(store.viewing).toBe("55");
        expect(
          resolveDashboardTabFromIntent({
            locationQuery,
            inferTabFromQuery: resolveUserDashboardTabFromQuery,
            resolveVisibleTab: resolveVisibleUserTab,
            visibleTabs: [
              ...USER_VISIBLE_TABS,
              { id: USER_DASHBOARD_TAB_IDS.MY_LISTINGS },
              { id: USER_DASHBOARD_TAB_IDS.PROFILE },
            ],
            entityTabMap,
            defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
          })
        ).toBe(USER_DASHBOARD_TAB_IDS.INBOX);
      });

      test("conversation store → new viewing URL: viewing wins, viewings tab", () => {
        const store = createDashboardIntentStore();
        store.conversation = "abc123";
        window.history.pushState(
          {},
          "",
          "/dashboard/user?tab=viewings&viewing=88"
        );

        const locationQuery = resolveDashboardLocationQuery({
          isReady: true,
          query: { tab: "viewings", viewing: "88" },
        });
        readDashboardIntent(store, { isReady: true, query: locationQuery });

        expect(store.conversation).toBe("abc123");
        expect(
          resolveDashboardTabFromIntent({
            locationQuery,
            inferTabFromQuery: resolveUserDashboardTabFromQuery,
            resolveVisibleTab: resolveVisibleUserTab,
            visibleTabs: USER_VISIBLE_TABS,
            entityTabMap,
            defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
          })
        ).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
      });

      test("viewing store → new listing URL: listing wins, my-listings tab", () => {
        const store = createDashboardIntentStore();
        store.viewing = "55";
        window.history.pushState(
          {},
          "",
          "/dashboard/user?tab=my-listings&listing=42"
        );

        const locationQuery = resolveDashboardLocationQuery({
          isReady: true,
          query: { tab: "my-listings", listing: "42" },
        });
        readDashboardIntent(store, { isReady: true, query: locationQuery });

        expect(
          resolveDashboardTabFromIntent({
            locationQuery,
            inferTabFromQuery: resolveUserDashboardTabFromQuery,
            resolveVisibleTab: resolveVisibleUserTab,
            visibleTabs: [
              ...USER_VISIBLE_TABS,
              { id: USER_DASHBOARD_TAB_IDS.MY_LISTINGS },
            ],
            entityTabMap,
            defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
          })
        ).toBe(USER_DASHBOARD_TAB_IDS.MY_LISTINGS);
      });

      test("entity store → explicit tab-only URL: stale entity does not force feature tab", () => {
        const store = createDashboardIntentStore();
        store.viewing = "55";
        window.history.pushState({}, "", "/dashboard/user?tab=profile");

        const locationQuery = resolveDashboardLocationQuery({
          isReady: true,
          query: { tab: "profile" },
        });
        readDashboardIntent(store, { isReady: true, query: locationQuery });

        expect(
          resolveDashboardTabFromIntent({
            locationQuery,
            inferTabFromQuery: resolveUserDashboardTabFromQuery,
            resolveVisibleTab: resolveVisibleUserTab,
            visibleTabs: [
              ...USER_VISIBLE_TABS,
              { id: USER_DASHBOARD_TAB_IDS.PROFILE },
            ],
            entityTabMap,
            defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
          })
        ).toBe(USER_DASHBOARD_TAB_IDS.PROFILE);
      });
    });
  });

  describe("resolveDashboardBootstrapPhase", () => {
    test("user dashboard waits for router then auth", () => {
      expect(
        resolveDashboardBootstrapPhase({
          routerReady: false,
          loading: false,
          user: { id: "u1" },
          role: "user",
          expectedRole: "user",
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING);

      expect(
        resolveDashboardBootstrapPhase({
          routerReady: true,
          loading: true,
          user: { id: "u1" },
          role: "user",
          expectedRole: "user",
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.AUTH_PENDING);
    });

    test("agent dashboard waits for router then auth", () => {
      expect(
        resolveDashboardBootstrapPhase({
          routerReady: false,
          loading: true,
          user: null,
          role: null,
          expectedRole: "agent",
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING);

      expect(
        resolveDashboardBootstrapPhase({
          routerReady: true,
          loading: true,
          user: { id: "a1" },
          role: "agent",
          expectedRole: "agent",
          profileHydrated: true,
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING);
    });

    test("delayed session restoration shows profile_pending instead of redirect", () => {
      expect(
        resolveDashboardBootstrapPhase({
          routerReady: true,
          loading: true,
          user: { id: "u1" },
          role: "user",
          expectedRole: "user",
          profileHydrated: true,
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING);
    });

    test("redirect phases only after bootstrap completes", () => {
      expect(
        resolveDashboardBootstrapPhase({
          routerReady: true,
          loading: false,
          user: null,
          role: null,
          expectedRole: "user",
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN);

      expect(
        resolveDashboardBootstrapPhase({
          routerReady: true,
          loading: false,
          user: { id: "u1" },
          role: "agent",
          expectedRole: "user",
        })
      ).toBe(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_DASHBOARD);
    });
  });

  describe("bootstrap shell contract", () => {
    test("never hides shell during pending phases (no blank dashboard)", () => {
      expect(
        shouldShowDashboardBootstrapShell(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING)
      ).toBe(true);
      expect(
        shouldShowDashboardBootstrapShell(DASHBOARD_BOOTSTRAP_PHASE.AUTH_PENDING)
      ).toBe(true);
      expect(
        shouldShowDashboardBootstrapShell(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN)
      ).toBe(true);
      expect(
        shouldShowDashboardBootstrapShell(DASHBOARD_BOOTSTRAP_PHASE.READY)
      ).toBe(false);
    });

    test("profile refresh keeps main dashboard visible when hydrating", () => {
      expect(
        shouldShowDashboardBootstrapShell(DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING, {
          showHydratingShell: true,
        })
      ).toBe(false);
    });

    test("redirect helpers gate on router-ready phases", () => {
      expect(shouldRunDashboardRedirect(DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING)).toBe(
        false
      );
      expect(shouldRunDashboardRedirect(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN)).toBe(
        true
      );
      expect(dashboardBootstrapShellLabel(DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN)).toBe(
        "Opening dashboard"
      );
    });
  });

  test("direct URL and push-style navigation share the same intent resolution", () => {
    window.history.pushState({}, "", "/dashboard/user?tab=viewings&viewing=108");
    const coldStartRouter = { isReady: false, query: {} };
    const hydratedRouter = {
      isReady: true,
      query: { tab: "viewings", viewing: "108" },
    };

    const storeA = createDashboardIntentStore();
    const storeB = createDashboardIntentStore();

    expect(readDashboardIntent(storeA, coldStartRouter).viewing).toBe("108");
    expect(readDashboardIntent(storeB, hydratedRouter).viewing).toBe("108");
    expect(
      resolveDashboardTabFromIntent({
        locationQuery: resolveDashboardLocationQuery(coldStartRouter),
        inferTabFromQuery: resolveUserDashboardTabFromQuery,
        resolveVisibleTab: resolveVisibleUserTab,
        visibleTabs: USER_VISIBLE_TABS,
        entityTabMap: { viewing: USER_DASHBOARD_TAB_IDS.VIEWINGS },
        defaultTab: USER_DASHBOARD_TAB_IDS.OVERVIEW,
      })
    ).toBe(USER_DASHBOARD_TAB_IDS.VIEWINGS);
  });
});
