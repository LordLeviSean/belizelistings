/**
 * Canonical SiteNav route resolution — homepage public shell is the source of truth.
 * Auth and marketing pages share browse chrome (filled Favorites/Agents idle pills).
 */

export const PUBLIC_BROWSE_SHELL_PATHS = Object.freeze([
  "/",
  "/search",
  "/learn-more",
  "/login",
  "/forgot-password",
  "/reset-password",
]);

/** Public marketing/discovery pages that mount full SiteNav (not dashboard/admin). */
export const PUBLIC_SITE_NAV_ROUTES = Object.freeze([
  { path: "/", navActive: "browse" },
  { path: "/search", navActive: "browse" },
  { path: "/listing/[id]", navActive: "browse", pattern: true },
  { path: "/listings/district/[district]", navActive: "browse", pattern: true },
  { path: "/favorites", navActive: "favorites" },
  { path: "/agents", navActive: "agents" },
  { path: "/agents/[username]", navActive: "agents", pattern: true },
  { path: "/learn-more", navActive: "browse" },
  { path: "/login", navActive: "browse" },
  { path: "/forgot-password", navActive: "browse" },
  { path: "/reset-password", navActive: "browse" },
  { path: "/auth/callback", navActive: "browse" },
]);

export function isPublicBrowseShellPath(pathname = "") {
  const path = pathname || "";
  if (PUBLIC_BROWSE_SHELL_PATHS.includes(path)) return true;
  if (path.startsWith("/listing/")) return true;
  if (path.startsWith("/listings/district/")) return true;
  if (path.startsWith("/auth/")) return true;
  return false;
}

/** Resolve SiteNav `active` tab from pathname when `active="auto"`. */
export function resolveSiteNavActiveFromPath(pathname = "") {
  const path = pathname || "";
  if (path === "/favorites") return "favorites";
  if (path === "/agents" || path.startsWith("/agents/")) return "agents";
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) return "dashboard";
  if (isPublicBrowseShellPath(path)) return "browse";
  return null;
}
