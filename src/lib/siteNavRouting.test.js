/** @jest-environment node */

import {
  PUBLIC_SITE_NAV_ROUTES,
  isPublicBrowseShellPath,
  resolveSiteNavActiveFromPath,
} from "./siteNavRouting";

describe("siteNavRouting", () => {
  describe("resolveSiteNavActiveFromPath", () => {
    test("browse shell routes match homepage public navigation chrome", () => {
      const browsePaths = [
        "/",
        "/search",
        "/learn-more",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/listing/42",
        "/listings/district/cayo",
        "/auth/callback",
      ];
      for (const path of browsePaths) {
        expect(resolveSiteNavActiveFromPath(path)).toBe("browse");
      }
    });

    test("favorites and agents resolve to their tabs", () => {
      expect(resolveSiteNavActiveFromPath("/favorites")).toBe("favorites");
      expect(resolveSiteNavActiveFromPath("/agents")).toBe("agents");
      expect(resolveSiteNavActiveFromPath("/agents/jane-doe")).toBe("agents");
    });

    test("dashboard and admin resolve to dashboard tab", () => {
      expect(resolveSiteNavActiveFromPath("/dashboard/user")).toBe("dashboard");
      expect(resolveSiteNavActiveFromPath("/dashboard/agent")).toBe("dashboard");
      expect(resolveSiteNavActiveFromPath("/admin")).toBe("dashboard");
      expect(resolveSiteNavActiveFromPath("/admin/marketplace-health")).toBe("dashboard");
    });

    test("unknown routes return null", () => {
      expect(resolveSiteNavActiveFromPath("/api/health")).toBeNull();
      expect(resolveSiteNavActiveFromPath("")).toBeNull();
    });
  });

  describe("isPublicBrowseShellPath", () => {
    test("auth routes use browse shell styling", () => {
      expect(isPublicBrowseShellPath("/login")).toBe(true);
      expect(isPublicBrowseShellPath("/forgot-password")).toBe(true);
      expect(isPublicBrowseShellPath("/reset-password")).toBe(true);
      expect(isPublicBrowseShellPath("/auth/callback")).toBe(true);
    });
  });

  describe("PUBLIC_SITE_NAV_ROUTES inventory", () => {
    test("auth pages auto-resolve to browse (Create Account parity)", () => {
      const authRoutes = PUBLIC_SITE_NAV_ROUTES.filter((r) =>
        ["/login", "/forgot-password", "/reset-password", "/auth/callback"].includes(r.path)
      );
      expect(authRoutes).toHaveLength(4);
      for (const route of authRoutes) {
        expect(route.navActive).toBe("browse");
      }
    });
  });
});
