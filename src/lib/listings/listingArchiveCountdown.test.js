/** @jest-environment node */

import {
  formatListingArchiveCountdown,
  getListingArchiveDeadlineMs,
  shouldShowListingArchiveCountdown,
} from "./listingArchiveCountdown";
import { LISTING_LIFECYCLE } from "../../constants/operationalModel";

describe("listingArchiveCountdown helpers", () => {
  const now = Date.parse("2026-07-10T12:00:00.000Z");
  const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "120" };

  const recentlySold = {
    id: 1,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    closed_at: "2026-07-10T10:00:00.000Z",
  };

  const recentlyRented = {
    id: 2,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
    rented_at: "2026-07-10T10:00:00.000Z",
    closed_at: "2026-07-10T10:00:00.000Z",
  };

  test("sold listing should show countdown", () => {
    expect(shouldShowListingArchiveCountdown(recentlySold)).toBe(true);
  });

  test("rented listing should show countdown", () => {
    expect(shouldShowListingArchiveCountdown(recentlyRented)).toBe(true);
  });

  test("active listing should not show countdown", () => {
    expect(
      shouldShowListingArchiveCountdown({
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      })
    ).toBe(false);
  });

  test("archived listing should not show countdown", () => {
    expect(
      shouldShowListingArchiveCountdown({
        status: "archived",
        lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      })
    ).toBe(false);
  });

  test("deadline uses configured duration not hardcoded 48 hours", () => {
    const deadlineMs = getListingArchiveDeadlineMs(recentlySold, qaEnv);
    expect(deadlineMs).toBe(Date.parse("2026-07-10T12:00:00.000Z"));
  });

  test("deadline derives from canonical closed timestamp", () => {
    const listing = {
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      updated_at: "2026-07-10T10:00:00.000Z",
    };
    const deadlineMs = getListingArchiveDeadlineMs(listing, qaEnv);
    expect(deadlineMs).toBe(Date.parse("2026-07-10T12:00:00.000Z"));
  });

  test("hours and minutes formatting is correct", () => {
    const deadlineMs = Date.parse("2026-07-10T14:18:00.000Z");
    const formatted = formatListingArchiveCountdown(deadlineMs, now);
    expect(formatted?.short).toBe("Archives in 2h 18m");
    expect(formatted?.ariaLabel).toMatch(/2 hours and 18 minutes/);
  });

  test("under-one-minute seconds formatting is correct", () => {
    const deadlineMs = Date.parse("2026-07-10T12:00:45.000Z");
    const formatted = formatListingArchiveCountdown(deadlineMs, now);
    expect(formatted?.short).toBe("Archives in 45s");
    expect(formatted?.needsSecondPrecision).toBe(true);
  });

  test("expired timer displays Archiving shortly…", () => {
    const deadlineMs = Date.parse("2026-07-10T11:59:00.000Z");
    const formatted = formatListingArchiveCountdown(deadlineMs, now);
    expect(formatted?.short).toBe("Archiving shortly…");
    expect(formatted?.expired).toBe(true);
  });

  test("invalid or missing timestamps fail gracefully", () => {
    expect(getListingArchiveDeadlineMs({ lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD })).toBe(
      null
    );
    expect(formatListingArchiveCountdown(null, now)).toBe(null);
  });
});
