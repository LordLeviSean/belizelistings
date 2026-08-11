/**
 * Session + query bootstrap helpers for `/dashboard/user`.
 * Push and hard navigations can arrive before Next.js router query hydration completes.
 */

/** @param {import("next/router").NextRouter["query"]} query */
function readQueryValue(query, key) {
  const raw = query?.[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

/**
 * Read a dashboard query param from the router when ready, otherwise from the live URL.
 * @param {{ isReady?: boolean, query?: object }} router
 * @param {string} paramName
 */
export function readUserDashboardQueryParam(router, paramName) {
  if (router?.isReady) {
    return readQueryValue(router.query, paramName);
  }

  if (typeof window === "undefined") return null;

  try {
    return new URLSearchParams(window.location.search).get(paramName);
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   loading?: boolean,
 *   user?: { id?: string } | null,
 *   role?: string,
 *   routerReady?: boolean,
 * }} input
 * @returns {"pending" | "ready" | "redirect-login" | "redirect-dashboard"}
 */
export function resolveUserDashboardSessionPhase({
  loading = false,
  user = null,
  role = "user",
  routerReady = true,
} = {}) {
  if (loading || !routerReady) return "pending";

  if (!user?.id) return "redirect-login";
  if (role !== "user") return "redirect-dashboard";
  return "ready";
}

export function shouldShowUserDashboardLoadingShell(sessionPhase) {
  return sessionPhase === "pending" || sessionPhase.startsWith("redirect-");
}

/**
 * Router query with live URL fallback while `router.isReady` is false.
 * @param {{ isReady?: boolean, query?: object }} router
 */
export function resolveUserDashboardLocationQuery(router) {
  if (router?.isReady) {
    return router.query ?? {};
  }

  return {
    tab: readUserDashboardQueryParam(router, "tab") ?? undefined,
    conversation: readUserDashboardQueryParam(router, "conversation") ?? undefined,
    viewing: readUserDashboardQueryParam(router, "viewing") ?? undefined,
    listing: readUserDashboardQueryParam(router, "listing") ?? undefined,
  };
}
