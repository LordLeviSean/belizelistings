/** @jest-environment node */

import {
  DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES,
  getListingArchiveDeadline,
  getListingClosedAt,
  isEligibleForClosedListingArchive,
  isListingEligibleForClosedArchive,
  isWithinRecentlyClosedWindow,
  resolveListingClosedArchiveMinutes,
} from "./listingClosedLifecycle";
import { LISTING_LIFECYCLE } from "./operationalModel";

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

  test("getListingClosedAt uses lifecycle-specific timestamps for recently sold", () => {
    expect(
      getListingClosedAt({
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
        closed_at: "2026-07-09T00:00:00.000Z",
        sold_at: "2026-07-08T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      })
    ).toBe("2026-07-09T00:00:00.000Z");
    expect(
      getListingClosedAt({
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
        sold_at: "2026-07-08T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      })
    ).toBe("2026-07-08T00:00:00.000Z");
    expect(
      getListingClosedAt({
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
        updated_at: "2026-07-01T00:00:00.000Z",
      })
    ).toBe("2026-07-01T00:00:00.000Z");
  });

  test("getListingClosedAt ignores stale closure timestamps outside recently closed lifecycle", () => {
    expect(
      getListingClosedAt({
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
        closed_at: "2026-07-09T00:00:00.000Z",
        sold_at: "2026-07-08T00:00:00.000Z",
      })
    ).toBeNull();
    expect(
      getListingClosedAt({
        status: "archived",
        lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
        sold_at: "2026-07-08T00:00:00.000Z",
      })
    ).toBeNull();
  });

  test("getListingClosedAt prefers the newest sold timestamp over stale closed_at", () => {
    expect(
      getListingClosedAt({
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
        closed_at: "2026-07-01T12:00:00.000Z",
        sold_at: "2026-07-10T10:00:00.000Z",
      })
    ).toBe("2026-07-10T10:00:00.000Z");
  });

  test("isListingEligibleForClosedArchive mirrors listing row closed timestamp", () => {
    const listing = {
      lifecycle_status: "recently_sold",
      updated_at: "2026-07-01T12:00:00.000Z",
    };
    const now = Date.parse("2026-07-10T12:00:00.000Z");
    expect(isListingEligibleForClosedArchive(listing, now)).toBe(true);
  });

  test("getListingArchiveDeadline adds configured archive minutes", () => {
    const listing = {
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-10T12:00:00.000Z",
    };
    const deadline = getListingArchiveDeadline(listing, {});
    expect(deadline?.toISOString()).toBe("2026-07-12T12:00:00.000Z");
  });
});
