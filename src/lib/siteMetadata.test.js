import {
  PAGE_TITLES,
  PAGE_DESCRIPTIONS,
  SITE_NAME,
  formatDistrictTitle,
  formatListingTitle,
  formatPageTitle,
  resolveDashboardTabTitle,
  resolveRouteDescription,
  resolveRouteTitle,
} from "./siteMetadata";

describe("formatPageTitle", () => {
  test("appends site name to a segment", () => {
    expect(formatPageTitle("Orange Walk")).toBe("Orange Walk | BelizeListings");
  });

  test("does not double-append site name", () => {
    expect(formatPageTitle("Dashboard | BelizeListings")).toBe("Dashboard | BelizeListings");
  });

  test("falls back to site name", () => {
    expect(formatPageTitle("")).toBe(SITE_NAME);
  });
});

describe("formatDistrictTitle", () => {
  test("uses district label with Listings suffix", () => {
    expect(formatDistrictTitle("Cayo")).toBe("Cayo Listings | BelizeListings");
  });
});

describe("formatListingTitle", () => {
  test("uses listing title with site suffix", () => {
    expect(formatListingTitle("Beachfront Villa")).toBe("Beachfront Villa | BelizeListings");
  });
});

describe("resolveDashboardTabTitle", () => {
  test("maps messages tab", () => {
    expect(resolveDashboardTabTitle("messages")).toBe(PAGE_TITLES.messages);
  });

  test("maps notifications tab", () => {
    expect(resolveDashboardTabTitle("notifications")).toBe(PAGE_TITLES.notifications);
  });

  test("returns null for other tabs", () => {
    expect(resolveDashboardTabTitle("overview")).toBeNull();
  });
});

describe("resolveRouteTitle", () => {
  test("homepage title", () => {
    expect(resolveRouteTitle("/")).toBe(PAGE_TITLES.home);
  });

  test("search title", () => {
    expect(resolveRouteTitle("/search")).toBe(PAGE_TITLES.search);
  });

  test("login vs register", () => {
    expect(resolveRouteTitle("/login")).toBe(PAGE_TITLES.login);
    expect(resolveRouteTitle("/login", { signup: "1" })).toBe(PAGE_TITLES.register);
  });

  test("dashboard messages tab", () => {
    expect(resolveRouteTitle("/dashboard/user", { tab: "messages" })).toBe(PAGE_TITLES.messages);
  });

  test("admin default title", () => {
    expect(resolveRouteTitle("/admin")).toBe(PAGE_TITLES.admin);
  });

  test("district route uses region label", () => {
    expect(resolveRouteTitle("/listings/district/cayo")).toBe("Cayo Listings | BelizeListings");
  });

  test("learn more title", () => {
    expect(resolveRouteTitle("/learn-more")).toBe(PAGE_TITLES.learnMore);
  });
});

describe("resolveRouteDescription", () => {
  test("learn more description", () => {
    expect(resolveRouteDescription("/learn-more")).toBe(PAGE_DESCRIPTIONS.learnMore);
  });

  test("defaults to site tagline", () => {
    expect(resolveRouteDescription("/")).toBe("Belize's Living Property Map");
  });
});
