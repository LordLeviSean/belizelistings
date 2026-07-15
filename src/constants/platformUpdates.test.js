/** @jest-environment node */

import {
  PLATFORM_UPDATE_IDS,
  getDefaultPlatformUpdate,
  getFeaturedPlatformUpdate,
  getGeographicUpdatePlatformEntry,
  getPlatformUpdatesArchive,
  getPlatformUpdateBySlug,
} from "./platformUpdates";
import {
  GEOGRAPHIC_UPDATE_MODAL_COPY,
  GEOGRAPHIC_UPDATE_NOTIFICATION,
} from "../lib/geography/geographicUpdateLaunch";

describe("platformUpdates registry", () => {
  test("archive includes required milestones", () => {
    const slugs = getPlatformUpdatesArchive().map((u) => u.slug);
    expect(slugs).toEqual([
      PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1,
      PLATFORM_UPDATE_IDS.CRM_V1,
      PLATFORM_UPDATE_IDS.OPEN_BETA,
      PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE,
    ]);
  });

  test("geographic update is featured default", () => {
    expect(getFeaturedPlatformUpdate()?.slug).toBe(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
    expect(getDefaultPlatformUpdate()?.slug).toBe(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1);
  });

  test("geographic update remains after modal window metadata", () => {
    const geo = getGeographicUpdatePlatformEntry();
    expect(geo?.modalEnd).toBe("2026-07-16");
    expect(getPlatformUpdateBySlug(PLATFORM_UPDATE_IDS.GEOGRAPHIC_V1)).toBeTruthy();
  });

  test("modal and archive share title, version, and CTA label", () => {
    const geo = getGeographicUpdatePlatformEntry();
    expect(GEOGRAPHIC_UPDATE_NOTIFICATION.title).toBe(`${geo.title} ${geo.version}`);
    expect(GEOGRAPHIC_UPDATE_NOTIFICATION.cta).toBe(geo.primaryCta.label);
    expect(GEOGRAPHIC_UPDATE_MODAL_COPY.title).toBe(GEOGRAPHIC_UPDATE_NOTIFICATION.title);
  });

  test("built for belize preserves mission sections", () => {
    const mission = getPlatformUpdateBySlug(PLATFORM_UPDATE_IDS.BUILT_FOR_BELIZE);
    expect(mission?.body).toMatch(/Explore\. Invest\. Thrive\./);
    expect(mission?.sections?.length).toBeGreaterThanOrEqual(3);
  });
});
