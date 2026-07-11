/** @jest-environment node */

import {
  RECENTLY_CLOSED_DISPLAY_DAYS,
  isWithinRecentlyClosedWindow,
  recentlyClosedDisplayMs,
} from "./listingClosedLifecycle";

describe("listingClosedLifecycle", () => {
  test("recentlyClosedDisplayMs matches configured days", () => {
    expect(recentlyClosedDisplayMs()).toBe(RECENTLY_CLOSED_DISPLAY_DAYS * 86_400_000);
  });

  test("isWithinRecentlyClosedWindow respects 30-day window", () => {
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    const closedAt = "2026-06-15T12:00:00.000Z";
    expect(isWithinRecentlyClosedWindow(closedAt, now)).toBe(true);
    expect(isWithinRecentlyClosedWindow("2026-05-01T12:00:00.000Z", now)).toBe(false);
  });
});
