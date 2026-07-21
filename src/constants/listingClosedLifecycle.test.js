/** @jest-environment node */

import {
  isEligibleForClosedListingArchive,
  isWithinRecentlyClosedWindow,
  RECENTLY_CLOSED_ARCHIVE_HOURS,
} from "./listingClosedLifecycle";

describe("listingClosedLifecycle", () => {
  const closedAt = "2026-07-10T12:00:00.000Z";

  test("uses 48-hour archive window", () => {
    expect(RECENTLY_CLOSED_ARCHIVE_HOURS).toBe(48);
  });

  test("isWithinRecentlyClosedWindow true before 48 hours", () => {
    const now = Date.parse("2026-07-11T11:00:00.000Z");
    expect(isWithinRecentlyClosedWindow(closedAt, now)).toBe(true);
  });

  test("isWithinRecentlyClosedWindow false after 48 hours", () => {
    const now = Date.parse("2026-07-12T13:00:00.000Z");
    expect(isWithinRecentlyClosedWindow(closedAt, now)).toBe(false);
  });

  test("isEligibleForClosedListingArchive true at 48h+", () => {
    const now = Date.parse("2026-07-12T13:00:00.000Z");
    expect(isEligibleForClosedListingArchive(closedAt, now)).toBe(true);
  });

  test("isEligibleForClosedListingArchive false before 48h", () => {
    const now = Date.parse("2026-07-11T11:00:00.000Z");
    expect(isEligibleForClosedListingArchive(closedAt, now)).toBe(false);
  });
});
