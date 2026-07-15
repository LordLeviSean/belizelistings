/** @jest-environment jsdom */

import {
  GEOGRAPHIC_UPDATE_LAUNCH_WINDOW,
  GEOGRAPHIC_UPDATE_NOTIFICATION,
  GEOGRAPHIC_UPDATE_MODAL_COPY,
  getVisitorLocalDateKey,
  hasSeenGeographicUpdateModalThisSession,
  isGeographicUpdateModalEligible,
  markGeographicUpdateModalSeenThisSession,
  resolveGeographicUpdateListingsHref,
} from "./geographicUpdateLaunch";

describe("geographicUpdateLaunch", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("dedupe key is deterministic", () => {
    expect(GEOGRAPHIC_UPDATE_NOTIFICATION.dedupeKey).toBe("geographic_update_v1:2026-07-13");
  });

  test("modal explore CTA targets archived learn-more geographic entry", () => {
    expect(GEOGRAPHIC_UPDATE_MODAL_COPY.learnMoreHref).toBe("/learn-more#geographic-update-v1");
  });

  test("role-aware deep links", () => {
    expect(resolveGeographicUpdateListingsHref("user")).toContain("my-listings");
    expect(resolveGeographicUpdateListingsHref("agent")).toContain("/dashboard/agent");
    expect(resolveGeographicUpdateListingsHref("admin")).toContain("/admin");
  });

  test("ineligible when outside launch window by visitor local date", () => {
    const eligible = isGeographicUpdateModalEligible({
      authenticated: true,
      role: "agent",
      now: new Date("2026-08-01T12:00:00Z"),
    });
    expect(eligible).toBe(false);
  });

  test("launch window uses visitor local calendar dates through July 16", () => {
    expect(GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.localEndDate).toBe("2026-07-16");
    const eligible = isGeographicUpdateModalEligible({
      authenticated: true,
      role: "agent",
      now: new Date("2026-07-16T23:00:00-06:00"),
    });
    expect(eligible).toBe(true);
  });

  test("eligible again on a new browser session the same local day", () => {
    const now = new Date("2026-07-15T10:00:00-06:00");
    markGeographicUpdateModalSeenThisSession(now);
    expect(hasSeenGeographicUpdateModalThisSession(now)).toBe(true);
    expect(
      isGeographicUpdateModalEligible({
        authenticated: true,
        role: "user",
        now,
      })
    ).toBe(false);
    window.sessionStorage.clear();
    expect(
      isGeographicUpdateModalEligible({
        authenticated: true,
        role: "user",
        now,
      })
    ).toBe(true);
  });

  test("auto-expires after the local launch end date without cleanup", () => {
    expect(getVisitorLocalDateKey(new Date("2026-07-17T01:00:00-06:00"))).toBe("2026-07-17");
    const eligible = isGeographicUpdateModalEligible({
      authenticated: true,
      role: "agent",
      now: new Date("2026-07-17T01:00:00-06:00"),
    });
    expect(eligible).toBe(false);
  });
});
