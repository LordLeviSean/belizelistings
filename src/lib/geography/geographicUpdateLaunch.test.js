import {
  GEOGRAPHIC_UPDATE_LAUNCH_WINDOW,
  GEOGRAPHIC_UPDATE_NOTIFICATION,
  isGeographicUpdateModalEligible,
  resolveGeographicUpdateListingsHref,
} from "./geographicUpdateLaunch";

describe("geographicUpdateLaunch", () => {
  test("dedupe key is deterministic", () => {
    expect(GEOGRAPHIC_UPDATE_NOTIFICATION.dedupeKey).toBe("geographic_update_v1:2026-07-13");
  });

  test("role-aware deep links", () => {
    expect(resolveGeographicUpdateListingsHref("user")).toContain("my-listings");
    expect(resolveGeographicUpdateListingsHref("agent")).toContain("/dashboard/agent");
    expect(resolveGeographicUpdateListingsHref("admin")).toContain("/admin");
  });

  test("ineligible when outside launch window", () => {
    const eligible = isGeographicUpdateModalEligible({
      authenticated: true,
      role: "agent",
      profile: {},
      now: new Date("2026-08-01T12:00:00Z"),
    });
    expect(eligible).toBe(false);
  });

  test("launch window documents America/Belize span through July 16", () => {
    expect(GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.timezone).toBe("America/Belize");
    expect(GEOGRAPHIC_UPDATE_LAUNCH_WINDOW.endUtc).toBe("2026-07-17T05:59:59.999Z");
    const eligible = isGeographicUpdateModalEligible({
      authenticated: true,
      role: "agent",
      profile: {},
      now: new Date("2026-07-16T23:00:00-06:00"),
    });
    expect(eligible).toBe(true);
  });
});
