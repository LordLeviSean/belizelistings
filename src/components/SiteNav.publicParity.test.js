/** @jest-environment node */

import fs from "fs";
import path from "path";
import { resolveSiteNavActiveFromPath } from "../lib/siteNavRouting";

const repoRoot = path.resolve(__dirname, "../..");

function readPage(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/** Mirrors SiteNav idle-home chrome flags for regression guards. */
function browseShellChromeFlags(pathname) {
  const resolvedActive = resolveSiteNavActiveFromPath(pathname);
  const favoritesNavActive = resolvedActive === "favorites";
  const agentsNavActive = resolvedActive === "agents";
  const favoritesIdleHomeChrome =
    !favoritesNavActive &&
    (pathname === "/" ||
      resolvedActive === "browse" ||
      resolvedActive === "dashboard" ||
      resolvedActive === "agents");
  const agentsIdleHomeChrome =
    !agentsNavActive &&
    (pathname === "/" ||
      resolvedActive === "browse" ||
      resolvedActive === "dashboard" ||
      resolvedActive === "favorites");
  return { resolvedActive, favoritesIdleHomeChrome, agentsIdleHomeChrome };
}

describe("SiteNav public navigation parity", () => {
  test("every public page mounts SiteNav (single canonical implementation)", () => {
    const publicPages = [
      "src/pages/index.js",
      "src/pages/search.jsx",
      "src/pages/listing/[id].js",
      "src/pages/listings/district/[district].jsx",
      "src/pages/favorites.jsx",
      "src/pages/agents.jsx",
      "src/pages/agents/[username].jsx",
      "src/pages/login.jsx",
      "src/pages/forgot-password.jsx",
      "src/pages/reset-password.jsx",
      "src/pages/auth/callback.jsx",
    ];

    for (const pagePath of publicPages) {
      const source = readPage(pagePath);
      expect(source).toMatch(/import SiteNav from/);
      expect(source).toMatch(/<SiteNav\b/);
    }

    const learnMore = readPage("src/components/learnMore/LearnMoreExperience.jsx");
    expect(learnMore).toMatch(/import SiteNav from/);
    expect(learnMore).toMatch(/<SiteNav active="browse"/);
  });

  test("auth routes share homepage browse-shell icon chrome", () => {
    const home = browseShellChromeFlags("/");
    const login = browseShellChromeFlags("/login");
    const signup = browseShellChromeFlags("/login");
    const forgot = browseShellChromeFlags("/forgot-password");
    const reset = browseShellChromeFlags("/reset-password");
    const callback = browseShellChromeFlags("/auth/callback");

    for (const flags of [login, signup, forgot, reset, callback]) {
      expect(flags.resolvedActive).toBe("browse");
      expect(flags.favoritesIdleHomeChrome).toBe(home.favoritesIdleHomeChrome);
      expect(flags.agentsIdleHomeChrome).toBe(home.agentsIdleHomeChrome);
    }
  });

  test("dashboard pages keep explicit dashboard active (unchanged)", () => {
    const dashboardPages = [
      "src/pages/dashboard/user.jsx",
      "src/pages/dashboard/agent.jsx",
      "src/pages/dashboard/broker.jsx",
      "src/pages/dashboard/create.jsx",
      "src/pages/admin/index.jsx",
      "src/pages/admin/marketplace-health.jsx",
    ];

    for (const pagePath of dashboardPages) {
      const source = readPage(pagePath);
      expect(source).toMatch(/<SiteNav active="dashboard"/);
      expect(source).not.toMatch(/variant="userDashboard"/);
    }
  });

  test("SiteNav resolves routes via shared siteNavRouting module", () => {
    const siteNavSource = readPage("src/components/SiteNav.jsx");
    expect(siteNavSource).toMatch(/resolveSiteNavActiveFromPath/);
    expect(siteNavSource).not.toMatch(/route === "\/login"/);
  });
});
