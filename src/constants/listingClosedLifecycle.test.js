/** @jest-environment node */

import {
  DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES,
  getListingArchiveDeadline,
  getListingClosedAt,
  isEligibleForClosedListingArchive,
  isListingEligibleForClosedArchive,
  isWithinRecentlyClosedWindow,
  parseListingTimestampMs,
  resolveListingClosedArchiveMinutes,
} from "./listingClosedLifecycle";
import { LISTING_LIFECYCLE } from "./operationalModel";
import {
  formatListingArchiveCountdown,
  getListingArchiveDeadlineMs,
} from "../lib/listings/listingArchiveCountdown";

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

  test("parseListingTimestampMs treats Z suffix as UTC", () => {
    expect(parseListingTimestampMs("2026-07-26T19:41:53.677Z")).toBe(
      Date.parse("2026-07-26T19:41:53.677Z")
    );
  });

  test("parseListingTimestampMs treats +00:00 suffix as UTC", () => {
    expect(parseListingTimestampMs("2026-07-26T19:41:53.677+00:00")).toBe(
      Date.parse("2026-07-26T19:41:53.677Z")
    );
  });

  test("parseListingTimestampMs treats offset-less Postgres values as UTC", () => {
    expect(parseListingTimestampMs("2026-07-26T18:40:24.009651")).toBe(
      Date.parse("2026-07-26T18:40:24.009651Z")
    );
  });

  test("listing 108 reset row uses sold_at instead of stale naive updated_at", () => {
    const listing = {
      id: 108,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-26T19:41:53.677+00:00",
      sold_at: "2026-07-26T19:41:53.677+00:00",
      updated_at: "2026-07-26T18:40:24.009651",
    };
    expect(getListingClosedAt(listing)).toBe("2026-07-26T19:41:53.677+00:00");
    const closedMs = parseListingTimestampMs(getListingClosedAt(listing));
    const nowMs = Date.parse("2026-07-26T19:42:00.000Z");
    const deadlineMs = getListingArchiveDeadlineMs(listing, {});
    expect(deadlineMs).toBe(closedMs + DEFAULT_LISTING_CLOSED_ARCHIVE_MINUTES * 60_000);
    const remainingHours = (deadlineMs - nowMs) / 3_600_000;
    expect(remainingHours).toBeLessThanOrEqual(48);
    expect(remainingHours).toBeGreaterThan(47.9);
    expect(formatListingArchiveCountdown(deadlineMs, nowMs)?.short).toBe("Archives in 47h 59m");
  });

  test("user, agent, and admin rows resolve the same archive deadline", () => {
    const base = {
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-26T19:41:53.677+00:00",
      sold_at: "2026-07-26T19:41:53.677+00:00",
      updated_at: "2026-07-26T18:40:24.009651",
    };
    const userRow = { ...base, id: 108 };
    const agentRow = { ...base, id: 108, agent_id: "agent-1" };
    const adminRow = { ...base, id: 108, moderation_status: "approved" };
    expect(getListingArchiveDeadlineMs(userRow, {})).toBe(getListingArchiveDeadlineMs(agentRow, {}));
    expect(getListingArchiveDeadlineMs(agentRow, {})).toBe(getListingArchiveDeadlineMs(adminRow, {}));
  });
});
