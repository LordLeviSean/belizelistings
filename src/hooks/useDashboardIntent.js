import { useEffect, useMemo, useRef } from "react";
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
    if (bootstrapPhase === "redirect_login") {
      router.replace("/login");
      return;
    }
    router.replace(redirectDashboardHref);
  }, [bootstrapPhase, router, redirectDashboardHref]);

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
