/**
 * Shared dashboard deep-link intent contract for BelizeListings.
 *
 * Works for push navigation, pasted URLs, internal links, refresh, and cold start.
 * Not notification-specific — any producer of a canonical dashboard URL can use this.
 */

/** Entity query params that imply a referenced record must be resolved downstream. */
export const DASHBOARD_ENTITY_PARAMS = Object.freeze(["viewing", "conversation", "listing"]);

/** All dashboard query params preserved through bootstrap. */
export const DASHBOARD_QUERY_PARAMS = Object.freeze(["tab", ...DASHBOARD_ENTITY_PARAMS]);

export const DASHBOARD_BOOTSTRAP_PHASE = Object.freeze({
  ROUTER_PENDING: "router_pending",
  AUTH_PENDING: "auth_pending",
  PROFILE_PENDING: "profile_pending",
  REDIRECT_LOGIN: "redirect_login",
  REDIRECT_DASHBOARD: "redirect_dashboard",
  READY: "ready",
});

/** @param {import("next/router").NextRouter["query"] | object} query */
export function readQueryValue(query, key) {
  const raw = query?.[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

/**
 * Read one query param from the router when available, otherwise from the live URL.
 * @param {{ isReady?: boolean, query?: object }} router
 * @param {string} paramName
 */
export function readDashboardQueryParam(router, paramName) {
  let fromRouter = null;
  if (router?.isReady) {
    fromRouter = readQueryValue(router.query, paramName);
    if (fromRouter) return fromRouter;
  }

  if (typeof window === "undefined") return fromRouter;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get(paramName);
    return fromUrl ?? fromRouter;
  } catch {
    return fromRouter;
  }
}

/**
 * Router query with live URL fallback for known dashboard params.
 * Preserves unrelated router query fields when the router is ready.
 * @param {{ isReady?: boolean, query?: object }} router
 */
export function resolveDashboardLocationQuery(router) {
  const base = router?.isReady ? { ...(router.query ?? {}) } : {};

  for (const param of DASHBOARD_QUERY_PARAMS) {
    const resolved = readDashboardQueryParam(router, param);
    if (resolved) {
      base[param] = resolved;
    }
  }

  return base;
}

/** @returns {{ tab: string|null, viewing: string|null, conversation: string|null, listing: string|null }} */
export function createDashboardIntentStore() {
  return {
    tab: null,
    viewing: null,
    conversation: null,
    listing: null,
  };
}

/**
 * Read and persist dashboard navigation intent across router/auth hydration.
 *
 * @param {{ tab: string|null, viewing: string|null, conversation: string|null, listing: string|null }} intentStore
 * @param {{ isReady?: boolean, query?: object }} router
 */
export function readDashboardIntent(intentStore, router) {
  const next = {
    tab: intentStore.tab,
    viewing: intentStore.viewing,
    conversation: intentStore.conversation,
    listing: intentStore.listing,
  };

  for (const param of DASHBOARD_QUERY_PARAMS) {
    const fromLocation = readDashboardQueryParam(router, param);
    if (fromLocation) {
      next[param] = fromLocation;
      intentStore[param] = fromLocation;
    }
  }

  return next;
}

/**
 * Clear persisted entity intent only when the user has left the feature tab
 * and the live URL no longer carries that entity param.
 *
 * @param {{ tab: string|null, viewing: string|null, conversation: string|null, listing: string|null }} intentStore
 * @param {{
 *   activeTab: string,
 *   router: { isReady?: boolean, query?: object },
 *   entityTabMap: Record<string, string>,
 * }} input
 */
export function maybeClearStaleDashboardIntent(intentStore, { activeTab, router, entityTabMap }) {
  for (const [entityParam, featureTab] of Object.entries(entityTabMap)) {
    if (activeTab === featureTab) continue;
    if (readDashboardQueryParam(router, entityParam)) continue;
    intentStore[entityParam] = null;
  }
}

/**
 * @param {{
 *   routerReady?: boolean,
 *   loading?: boolean,
 *   user?: { id?: string } | null,
 *   role?: string | null,
 *   expectedRole: string,
 *   profileHydrated?: boolean,
 * }} input
 */
export function resolveDashboardBootstrapPhase({
  routerReady = false,
  loading = false,
  user = null,
  role = null,
  expectedRole,
  profileHydrated = false,
} = {}) {
  if (!routerReady) return DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING;

  if (loading) {
    if (profileHydrated && role === expectedRole) {
      return DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING;
    }
    return DASHBOARD_BOOTSTRAP_PHASE.AUTH_PENDING;
  }

  if (!user?.id) return DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN;
  if (role !== expectedRole) return DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_DASHBOARD;
  return DASHBOARD_BOOTSTRAP_PHASE.READY;
}

/**
 * @param {string} phase
 * @param {{ showHydratingShell?: boolean }} [options]
 */
export function shouldShowDashboardBootstrapShell(phase, { showHydratingShell = false } = {}) {
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.READY) return false;
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.PROFILE_PENDING && showHydratingShell) return false;
  return true;
}

/**
 * Resolve bootstrap shell aria-label from phase.
 * @param {string} phase
 */
export function dashboardBootstrapShellLabel(phase) {
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.ROUTER_PENDING) return "Loading dashboard";
  if (phase === DASHBOARD_BOOTSTRAP_PHASE.AUTH_PENDING) return "Loading dashboard";
  if (phase.startsWith("redirect_")) return "Opening dashboard";
  return "Loading dashboard";
}

/**
 * Force the feature tab when an entity param is explicitly present in the current location.
 * Uses location query only — persisted store values survive hydration but do not override
 * a newer settled URL (e.g. viewing → conversation navigation without remount).
 *
 * @param {{
 *   locationQuery: object,
 *   inferTabFromQuery: (query: object) => string,
 *   resolveVisibleTab: (rawTab: string, visibleTabs: Array<{ id: string }>) => string,
 *   visibleTabs: Array<{ id: string }>,
 *   entityTabMap: Partial<Record<"viewing"|"conversation"|"listing", string>>,
 *   defaultTab: string,
 * }} input
 */
export function resolveDashboardTabFromIntent({
  locationQuery,
  inferTabFromQuery,
  resolveVisibleTab,
  visibleTabs,
  entityTabMap,
  defaultTab,
}) {
  const explicitViewing = readQueryValue(locationQuery, "viewing");
  const explicitConversation = readQueryValue(locationQuery, "conversation");
  const explicitListing = readQueryValue(locationQuery, "listing");

  if (explicitViewing && entityTabMap.viewing) {
    return resolveVisibleTab(entityTabMap.viewing, visibleTabs);
  }
  if (explicitConversation && entityTabMap.conversation) {
    return resolveVisibleTab(entityTabMap.conversation, visibleTabs);
  }
  if (explicitListing && entityTabMap.listing) {
    return resolveVisibleTab(entityTabMap.listing, visibleTabs);
  }

  const inferred = inferTabFromQuery(locationQuery);
  return resolveVisibleTab(inferred || defaultTab, visibleTabs);
}

/**
 * Whether redirects should run (router ready + redirect phase).
 * @param {string} phase
 */
export function shouldRunDashboardRedirect(phase) {
  return (
    phase === DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_LOGIN ||
    phase === DASHBOARD_BOOTSTRAP_PHASE.REDIRECT_DASHBOARD
  );
}
