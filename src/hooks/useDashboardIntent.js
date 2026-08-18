import { useEffect, useMemo, useRef } from "react";
import {
  buildProtectedLoginHref,
  captureProtectedEntryFromWindow,
  clearPendingProtectedEntry,
  readPendingProtectedEntry,
  resolveProtectedEntryHref,
  savePendingProtectedEntry,
  shouldAcknowledgeProtectedEntry,
} from "@/lib/auth/protectedEntry";
import {
  createDashboardIntentStore,
  dashboardBootstrapShellLabel,
  maybeClearStaleDashboardIntent,
  readDashboardIntent,
  resolveDashboardBootstrapPhase,
  resolveDashboardLocationQuery,
  resolveDashboardTabFromIntent,
  shouldRunDashboardRedirect,
  shouldShowDashboardBootstrapShell,
} from "@/lib/dashboard/dashboardIntent";

/**
 * Shared dashboard deep-link intent + bootstrap phase for role-specific dashboards.
 *
 * @param {{
 *   router: import("next/router").NextRouter,
 *   expectedRole: string,
 *   user: { id?: string } | null,
 *   role: string | null,
 *   loading: boolean,
 *   profileHydrated: boolean,
 *   visibleTabs: Array<{ id: string }>,
 *   entityTabMap: Partial<Record<"viewing"|"conversation"|"listing", string>>,
 *   inferTabFromQuery: (query: object) => string,
 *   resolveVisibleTab: (rawTab: string, visibleTabs: Array<{ id: string }>) => string,
 *   defaultTab: string,
 *   redirectDashboardHref?: string,
 * }} config
 */
export function useDashboardIntent({
  router,
  expectedRole,
  user,
  role,
  loading,
  profileHydrated,
  visibleTabs,
  entityTabMap,
  inferTabFromQuery,
  resolveVisibleTab,
  defaultTab,
  redirectDashboardHref = "/dashboard",
}) {
  const intentStoreRef = useRef(createDashboardIntentStore());
  const protectedEntryRef = useRef(null);

  useEffect(() => {
    const fromWindow = captureProtectedEntryFromWindow();
    if (fromWindow) {
      protectedEntryRef.current = fromWindow;
      savePendingProtectedEntry(fromWindow);
      return;
    }
    const pending = readPendingProtectedEntry();
    if (pending?.href) {
      protectedEntryRef.current = pending.href;
    }
  }, []);

  useEffect(() => {
    const resolved = resolveProtectedEntryHref({
      router,
      pendingFromStorage: protectedEntryRef.current
        ? { href: protectedEntryRef.current }
        : readPendingProtectedEntry(),
    });
    if (resolved) {
      protectedEntryRef.current = resolved;
      savePendingProtectedEntry(resolved);
    }
  }, [
    router.isReady,
    router.pathname,
    router.asPath,
    router.query.tab,
    router.query.conversation,
    router.query.viewing,
    router.query.listing,
  ]);

  const locationQuery = useMemo(
    () => resolveDashboardLocationQuery(router),
    [
      router.isReady,
      router.query.tab,
      router.query.conversation,
      router.query.viewing,
      router.query.listing,
    ]
  );

  const intent = useMemo(
    () => readDashboardIntent(intentStoreRef.current, router),
    [
      router.isReady,
      router.query.tab,
      router.query.conversation,
      router.query.viewing,
      router.query.listing,
    ]
  );

  const activeTab = useMemo(
    () =>
      resolveDashboardTabFromIntent({
        locationQuery,
        inferTabFromQuery,
        resolveVisibleTab,
        visibleTabs,
        entityTabMap,
        defaultTab,
      }),
    [locationQuery, inferTabFromQuery, resolveVisibleTab, visibleTabs, entityTabMap, defaultTab]
  );

  const showHydratingShell = Boolean(loading && profileHydrated && role === expectedRole);

  const bootstrapPhase = useMemo(
    () =>
      resolveDashboardBootstrapPhase({
        routerReady: router.isReady,
        loading,
        user,
        role,
        expectedRole,
        profileHydrated,
      }),
    [router.isReady, loading, user, role, expectedRole, profileHydrated]
  );

  const showBootstrapShell = shouldShowDashboardBootstrapShell(bootstrapPhase, {
    showHydratingShell,
  });

  const bootstrapShellLabel = dashboardBootstrapShellLabel(bootstrapPhase);

  useEffect(() => {
    if (!shouldRunDashboardRedirect(bootstrapPhase)) return;

    const destination =
      protectedEntryRef.current ||
      resolveProtectedEntryHref({ router, pendingFromStorage: readPendingProtectedEntry() });

    if (bootstrapPhase === "redirect_login") {
      if (destination) {
        savePendingProtectedEntry(destination);
      }
      router.replace(buildProtectedLoginHref(destination || router.asPath || "/dashboard"));
      return;
    }

    router.replace(redirectDashboardHref);
  }, [bootstrapPhase, router, redirectDashboardHref]);

  useEffect(() => {
    if (bootstrapPhase !== "ready") return;

    const destination =
      protectedEntryRef.current ||
      resolveProtectedEntryHref({ router, pendingFromStorage: readPendingProtectedEntry() });

    const acknowledged = shouldAcknowledgeProtectedEntry({
      pathname: router.pathname,
      expectedRole,
      role,
      intent,
      destinationHref: destination,
    });

    if (!acknowledged) return;

    clearPendingProtectedEntry();
    protectedEntryRef.current = null;
  }, [
    bootstrapPhase,
    router.pathname,
    expectedRole,
    role,
    intent.tab,
    intent.conversation,
    intent.viewing,
    intent.listing,
  ]);

  useEffect(() => {
    maybeClearStaleDashboardIntent(intentStoreRef.current, {
      activeTab,
      router,
      entityTabMap,
    });
  }, [activeTab, router.isReady, router.query.viewing, router.query.conversation, router.query.listing, entityTabMap]);

  return {
    intent,
    locationQuery,
    activeTab,
    bootstrapPhase,
    showBootstrapShell,
    showHydratingShell,
    bootstrapShellLabel,
    deepLinkViewingId: intent.viewing,
    deepLinkConversationId: intent.conversation,
    deepLinkListingId: intent.listing,
  };
}

export default useDashboardIntent;
