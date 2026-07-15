/** @jest-environment node */

import { PLATFORM_UPDATE_IDS } from "../constants/platformUpdates";
import {
  buildLearnMoreUpdateHref,
  getGeographicUpdateLearnMoreHref,
  parseLearnMoreUpdateSlug,
  resolvePlatformUpdateFromRoute,
  resolveUpdatePrimaryCtaHref,
} from "./platformUpdatesRouting";

describe("platformUpdatesRouting", () => {
  test("buildLearnMoreUpdateHref encodes slug hash", () => {
    expect(buildLearnMoreUpdateHref(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1)).toBe(
      "/learn-more#geographic-update-v1"
    );
    expect(getGeographicUpdateLearnMoreHref()).toBe("/learn-more#geographic-update-v1");
  });

  test("parseLearnMoreUpdateSlug reads hash and query", () => {
    expect(parseLearnMoreUpdateSlug({ hash: "#crm-v1" })).toBe("crm-v1");
    expect(parseLearnMoreUpdateSlug({ update: "open-beta" })).toBe("open-beta");
  });

  test("resolvePlatformUpdateFromRoute deep-links geographic update", () => {
    const update = resolvePlatformUpdateFromRoute(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
    expect(update.slug).toBe(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
  });

  test("unknown slug falls back to featured update", () => {
    const update = resolvePlatformUpdateFromRoute("does-not-exist");
    expect(update.slug).toBe(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
  });

  test("role-aware Update My Listings CTA for authenticated users", () => {
    const geo = resolvePlatformUpdateFromRoute(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
    expect(resolveUpdatePrimaryCtaHref(geo, { authenticated: true, role: "agent" })).toContain(
      "/dashboard/agent"
    );
    expect(resolveUpdatePrimaryCtaHref(geo, { authenticated: true, role: "admin" })).toContain(
      "/admin"
    );
  });

  test("unauthenticated Update My Listings CTA routes to signup with return path", () => {
    const geo = resolvePlatformUpdateFromRoute(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
    const href = resolveUpdatePrimaryCtaHref(geo, { authenticated: false });
    expect(href).toContain("/login?signup=1");
    expect(href).toContain("returnTo=");
    expect(decodeURIComponent(href)).toContain("my-listings");
  });
});
