/** @jest-environment node */

import {
  buildListingClosureCycleResetPatch,
  buildModerationApprovePatch,
  buildModerationResubmitPatch,
  buildRecentlyRentedFallback,
  buildRecentlyRentedPatch,
  buildRecentlySoldFallback,
  buildRecentlySoldPatch,
  RECENTLY_RENTED_STATUS_TIERS,
  RECENTLY_SOLD_STATUS_TIERS,
} from "./listingWriteContract";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import {
  getListingArchiveDeadline,
  getListingClosedAt,
} from "../constants/listingClosedLifecycle";
import { formatListingArchiveCountdown } from "./listings/listingArchiveCountdown";

describe("recently closed lifecycle patches", () => {
  test("buildRecentlySoldPatch keeps status approved and sets lifecycle recently_sold", () => {
    const patch = buildRecentlySoldPatch();
    expect(patch.status).toBe("approved");
    expect(patch.lifecycle_status).toBe(LISTING_LIFECYCLE.RECENTLY_SOLD);
    expect(patch.sold_at).toBeTruthy();
    expect(patch.closed_at).toBeTruthy();
  });

  test("buildRecentlyRentedPatch keeps status approved and sets lifecycle recently_rented", () => {
    const patch = buildRecentlyRentedPatch();
    expect(patch.status).toBe("approved");
    expect(patch.lifecycle_status).toBe(LISTING_LIFECYCLE.RECENTLY_RENTED);
    expect(patch.rented_at).toBeTruthy();
    expect(patch.closed_at).toBeTruthy();
  });

  test("completion fallbacks include close timestamps for public visibility", () => {
    const soldFallback = buildRecentlySoldFallback();
    const rentedFallback = buildRecentlyRentedFallback();
    expect(soldFallback.closed_at).toBeTruthy();
    expect(soldFallback.sold_at).toBeTruthy();
    expect(rentedFallback.closed_at).toBeTruthy();
    expect(rentedFallback.rented_at).toBeTruthy();
  });

  test("status tiers never write closure values into listings.status", () => {
    for (const tier of RECENTLY_SOLD_STATUS_TIERS) {
      if ("status" in tier) {
        expect(tier.status).toBe("approved");
      }
    }
    for (const tier of RECENTLY_RENTED_STATUS_TIERS) {
      if ("status" in tier) {
        expect(tier.status).toBe("approved");
      }
    }
  });

  test("closure cycle reset patch clears prior sold/rented/archive timestamps", () => {
    expect(buildListingClosureCycleResetPatch()).toEqual({
      closed_at: null,
      sold_at: null,
      rented_at: null,
      archived_at: null,
    });
    expect(buildModerationResubmitPatch().closed_at).toBeNull();
    expect(buildModerationApprovePatch().sold_at).toBeNull();
  });

  test("recently sold patch clears prior rented/archive timestamps", () => {
    const patch = buildRecentlySoldPatch({ closedAt: "2026-07-10T10:00:00.000Z" });
    expect(patch.rented_at).toBeNull();
    expect(patch.archived_at).toBeNull();
    expect(patch.sold_at).toBe("2026-07-10T10:00:00.000Z");
    expect(patch.closed_at).toBe("2026-07-10T10:00:00.000Z");
  });

  test("recently rented patch clears prior sold/archive timestamps", () => {
    const patch = buildRecentlyRentedPatch({ closedAt: "2026-07-10T10:00:00.000Z" });
    expect(patch.sold_at).toBeNull();
    expect(patch.archived_at).toBeNull();
    expect(patch.rented_at).toBe("2026-07-10T10:00:00.000Z");
    expect(patch.closed_at).toBe("2026-07-10T10:00:00.000Z");
  });

  test("Sold → Archived → Restore → Approve → Sold again starts at full duration", () => {
    const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "120" };
    const firstSoldAt = "2026-07-01T12:00:00.000Z";
    const secondSoldAt = "2026-07-10T10:00:00.000Z";
    const now = Date.parse("2026-07-10T10:30:00.000Z");

    let listing = {
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      sold_at: firstSoldAt,
      closed_at: firstSoldAt,
    };
    expect(getListingArchiveDeadline(listing, qaEnv)?.toISOString()).toBe("2026-07-01T14:00:00.000Z");

    listing = {
      ...listing,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      archived_at: "2026-07-03T12:00:00.000Z",
    };
    expect(getListingClosedAt(listing)).toBeNull();

    listing = {
      ...listing,
      ...buildModerationResubmitPatch(),
      status: "pending",
      lifecycle_status: LISTING_LIFECYCLE.PENDING_REVIEW,
    };
    expect(getListingClosedAt(listing)).toBeNull();

    listing = {
      ...listing,
      ...buildModerationApprovePatch(),
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      updated_at: "2026-07-05T12:00:00.000Z",
    };
    expect(getListingClosedAt(listing)).toBeNull();

    listing = {
      ...listing,
      ...buildRecentlySoldPatch({ closedAt: secondSoldAt }),
    };
    const deadline = getListingArchiveDeadline(listing, qaEnv);
    expect(deadline?.toISOString()).toBe("2026-07-10T12:00:00.000Z");
    expect(formatListingArchiveCountdown(deadline?.getTime(), now)?.short).toBe("Archives in 1h 30m");
  });

  test("Rented cycle reset matches sold cycle reset behavior", () => {
    const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "120" };
    const firstRentedAt = "2026-07-01T12:00:00.000Z";
    const secondRentedAt = "2026-07-10T10:00:00.000Z";

    let listing = {
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
      rented_at: firstRentedAt,
      closed_at: firstRentedAt,
    };
    expect(getListingArchiveDeadline(listing, qaEnv)?.toISOString()).toBe("2026-07-01T14:00:00.000Z");

    listing = {
      ...listing,
      ...buildModerationApprovePatch(),
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
    };
    listing = {
      ...listing,
      ...buildRecentlyRentedPatch({ closedAt: secondRentedAt }),
    };
    expect(getListingArchiveDeadline(listing, qaEnv)?.toISOString()).toBe("2026-07-10T12:00:00.000Z");
  });

  test("multiple archive cycles always reset correctly", () => {
    const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "60" };
    const cycles = [
      "2026-06-01T12:00:00.000Z",
      "2026-07-01T12:00:00.000Z",
      "2026-07-10T10:00:00.000Z",
    ];

    let listing = { status: "approved", lifecycle_status: LISTING_LIFECYCLE.PUBLISHED };
    for (const closedAt of cycles) {
      listing = {
        ...listing,
        ...buildRecentlySoldPatch({ closedAt }),
      };
      expect(getListingArchiveDeadline(listing, qaEnv)?.toISOString()).toBe(
        new Date(Date.parse(closedAt) + 60 * 60_000).toISOString()
      );
      listing = {
        ...listing,
        status: "archived",
        lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
        archived_at: closedAt,
      };
      listing = {
        ...listing,
        ...buildModerationApprovePatch(),
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      };
    }
  });

  test("fallback sold/rented patches also reset closure cycle timestamps", () => {
    expect(buildRecentlySoldFallback().rented_at).toBeNull();
    expect(buildRecentlySoldFallback().sold_at).toBeTruthy();
    expect(buildRecentlyRentedFallback().sold_at).toBeNull();
    expect(buildRecentlyRentedFallback().rented_at).toBeTruthy();
  });
});
