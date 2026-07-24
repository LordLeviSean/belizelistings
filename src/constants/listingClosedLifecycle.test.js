/** @jest-environment node */

import {
  DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES,
  isEligibleForClosedListingArchive,
  isWithinRecentlyClosedWindow,
  resolveListingClosedArchiveMinutes,
} from "./listingClosedLifecycle";

describe("listingClosedLifecycle", () => {
  const closedAt = "2026-07-10T12:00:00.000Z";
  const defaultEnv = {};

  test("archive configuration defaults to 48 hours", () => {
    expect(resolveListingClosedArchiveMinutes({})).toBe(DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES);
    expect(DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES).toBe(48 * 60);
  });

  test("archive configuration accepts one-minute QA override", () => {
    expect(resolveListingClosedArchiveMinutes({ LISTING_CLOSED_ARCHIVE_MINUTES: "1" })).toBe(1);
    expect(
      resolveListingClosedArchiveMinutes({ NEXT_PUBLIC_LISTING_CLOSED_ARCHIVE_MINUTES: "1" })
    ).toBe(1);
  });

  test("isWithinRecentlyClosedWindow true before archive window", () => {
    const now = Date.parse("2026-07-11T11:00:00.000Z");
    expect(isWithinRecentlyClosedWindow(closedAt, now, defaultEnv)).toBe(true);
  });

  test("isWithinRecentlyClosedWindow false after archive window", () => {
    const now = Date.parse("2026-07-12T13:00:00.000Z");
    expect(isWithinRecentlyClosedWindow(closedAt, now, defaultEnv)).toBe(false);
  });

  test("isEligibleForClosedListingArchive true at 48h+", () => {
    const now = Date.parse("2026-07-12T13:00:00.000Z");
    expect(isEligibleForClosedListingArchive(closedAt, now, defaultEnv)).toBe(true);
  });

  test("isEligibleForClosedListingArchive false before 48h", () => {
    const now = Date.parse("2026-07-11T11:00:00.000Z");
    expect(isEligibleForClosedListingArchive(closedAt, now, defaultEnv)).toBe(false);
  });

  test("one-minute QA override shrinks the public window", () => {
    const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "1" };
    const closed = "2026-07-10T12:00:00.000Z";
    const now = Date.parse("2026-07-10T12:01:30.000Z");
    expect(isWithinRecentlyClosedWindow(closed, now, qaEnv)).toBe(false);
    expect(isEligibleForClosedListingArchive(closed, now, qaEnv)).toBe(true);
  });
});
