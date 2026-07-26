/** @jest-environment node */

import {
  getListingArchiveDeadline,
  getListingClosedAt,
  isListingEligibleForClosedArchive,
  isListingWithinRecentlyClosedWindow,
} from "./listingClosedLifecycle";
import {
  filterArchivedListingsPanelRows,
  filterMyListingsPanelRows,
} from "../lib/userDashboardListingTruth";
import {
  filterBrowsableInventory,
  getLifecycleStatus,
  isListingEngagementEnabled,
  isListingPubliclyVisible,
} from "../utils/canonicalListing";
import { LISTING_LIFECYCLE } from "./operationalModel";

describe("closed listing archive lifecycle contract", () => {
  const now = Date.parse("2026-07-10T12:00:00.000Z");
  const defaultEnv = {};

  const recentlySold = {
    id: 1,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    sold_at: "2026-07-10T11:59:00.000Z",
    closed_at: "2026-07-10T11:59:00.000Z",
    listing_type: "sale",
  };

  const recentlyRented = {
    id: 2,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
    rented_at: "2026-07-10T11:59:00.000Z",
    closed_at: "2026-07-10T11:59:00.000Z",
    listing_type: "rent",
  };

  const legacyUpdatedAtOnly = {
    id: 3,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    updated_at: "2026-07-07T12:00:00.000Z",
    listing_type: "sale",
  };

  const stuckLimboRow = {
    id: 99,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    updated_at: "2026-07-01T12:00:00.000Z",
  };

  test("recently sold listing remains public before archive eligibility", () => {
    expect(isListingPubliclyVisible(recentlySold, now)).toBe(true);
    expect(isListingEligibleForClosedArchive(recentlySold, now, defaultEnv)).toBe(false);
  });

  test("recently rented listing remains public before archive eligibility", () => {
    expect(isListingPubliclyVisible(recentlyRented, now)).toBe(true);
    expect(isListingEligibleForClosedArchive(recentlyRented, now, defaultEnv)).toBe(false);
  });

  test("eligible sold listing is no longer public and is archive-eligible", () => {
    const expiredSold = {
      ...recentlySold,
      sold_at: "2026-07-07T12:00:00.000Z",
      closed_at: "2026-07-07T12:00:00.000Z",
    };
    expect(isListingPubliclyVisible(expiredSold, now)).toBe(false);
    expect(isListingEligibleForClosedArchive(expiredSold, now, defaultEnv)).toBe(true);
  });

  test("eligible rented listing is no longer public and is archive-eligible", () => {
    const expiredRented = {
      ...recentlyRented,
      rented_at: "2026-07-07T12:00:00.000Z",
      closed_at: "2026-07-07T12:00:00.000Z",
    };
    expect(isListingPubliclyVisible(expiredRented, now)).toBe(false);
    expect(isListingEligibleForClosedArchive(expiredRented, now, defaultEnv)).toBe(true);
  });

  test("legacy updated_at-only rows use the same timestamp for visibility and archive eligibility", () => {
    expect(getListingClosedAt(legacyUpdatedAtOnly)).toBe("2026-07-07T12:00:00.000Z");
    expect(isListingPubliclyVisible(legacyUpdatedAtOnly, now)).toBe(false);
    expect(isListingEligibleForClosedArchive(legacyUpdatedAtOnly, now, defaultEnv)).toBe(true);
  });

  test("public visibility does not expire before archive eligibility", () => {
    const closedAt = "2026-07-08T12:00:00.000Z";
    const listing = {
      id: 4,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: closedAt,
    };
    const closedMs = Date.parse(closedAt);
    for (let offsetHours = 0; offsetHours <= 72; offsetHours += 1) {
      const ts = closedMs + offsetHours * 3_600_000;
      const visible = isListingPubliclyVisible(listing, ts);
      const eligible = isListingEligibleForClosedArchive(listing, ts, defaultEnv);
      if (!visible && offsetHours < 48) {
        expect(eligible).toBe(false);
      }
      if (eligible && offsetHours > 48) {
        expect(visible).toBe(false);
      }
    }
  });

  test("closed_at uses the newest matching timestamp for recently sold rows", () => {
    const row = {
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-09T12:00:00.000Z",
      sold_at: "2026-07-07T12:00:00.000Z",
      updated_at: "2026-07-01T12:00:00.000Z",
    };
    expect(getListingClosedAt(row)).toBe("2026-07-09T12:00:00.000Z");
  });

  test("archive deadline uses configured duration not a hardcoded 48h literal", () => {
    const qaEnv = { LISTING_CLOSED_ARCHIVE_MINUTES: "60" };
    const deadline = getListingArchiveDeadline(recentlySold, qaEnv);
    expect(deadline?.toISOString()).toBe("2026-07-10T12:59:00.000Z");
  });

  test("archived listings leave public browse", () => {
    const archived = {
      id: 5,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      sold_at: "2026-07-01T12:00:00.000Z",
    };
    expect(isListingPubliclyVisible(archived, now)).toBe(false);
    expect(filterBrowsableInventory([archived, recentlySold], now).map((r) => r.id)).toEqual([1]);
  });

  test("archived listings appear in owner Archived tab", () => {
    const archived = {
      id: 6,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      archived_at: "2026-07-10T12:00:00.000Z",
    };
    expect(filterArchivedListingsPanelRows([archived]).map((r) => r.id)).toEqual([6]);
  });

  test("admin, agent, and user resolve the same archived state via getLifecycleStatus", () => {
    const archived = {
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      moderation_status: "archived",
    };
    expect(getLifecycleStatus(archived)).toBe(LISTING_LIFECYCLE.ARCHIVED);
  });

  test("status archived with legacy recently_sold lifecycle still resolves archived", () => {
    const partiallyMigrated = {
      id: 10,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      sold_at: "2026-07-01T12:00:00.000Z",
    };
    expect(getLifecycleStatus(partiallyMigrated)).toBe(LISTING_LIFECYCLE.ARCHIVED);
    expect(filterArchivedListingsPanelRows([partiallyMigrated]).map((r) => r.id)).toEqual([10]);
  });

  test("engagement remains disabled while recently closed", () => {
    expect(isListingEngagementEnabled(recentlySold)).toBe(false);
    expect(isListingEngagementEnabled(recentlyRented)).toBe(false);
  });

  test("stuck limbo row is not in Archived tab until status becomes archived", () => {
    expect(filterArchivedListingsPanelRows([stuckLimboRow])).toEqual([]);
    expect(filterMyListingsPanelRows([stuckLimboRow]).map((r) => r.id)).toEqual([99]);
    expect(isListingEligibleForClosedArchive(stuckLimboRow, now, defaultEnv)).toBe(true);
  });

  test("auto-archived row leaves My Listings and appears in Archived", () => {
    const autoArchived = {
      ...stuckLimboRow,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      archived_at: "2026-07-10T12:00:00.000Z",
    };
    expect(filterMyListingsPanelRows([autoArchived]).map((r) => r.id)).toEqual([]);
    expect(filterArchivedListingsPanelRows([autoArchived]).map((r) => r.id)).toEqual([99]);
  });

  test("sold and rented timestamps are preserved conceptually after archival transition", () => {
    const autoArchived = {
      id: 7,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      sold_at: "2026-07-01T12:00:00.000Z",
      rented_at: null,
      closed_at: "2026-07-01T12:00:00.000Z",
      archived_at: "2026-07-03T12:00:00.000Z",
    };
    expect(autoArchived.sold_at).toBe("2026-07-01T12:00:00.000Z");
    expect(autoArchived.closed_at).toBe("2026-07-01T12:00:00.000Z");
    expect(getLifecycleStatus(autoArchived)).toBe(LISTING_LIFECYCLE.ARCHIVED);
  });

  test("manually archived listings are unaffected by recently closed helpers", () => {
    const manual = {
      id: 8,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      archived_at: "2026-05-01T12:00:00.000Z",
    };
    expect(isListingEligibleForClosedArchive(manual, now, defaultEnv)).toBe(false);
    expect(isListingWithinRecentlyClosedWindow(manual, now, defaultEnv)).toBe(false);
    expect(filterArchivedListingsPanelRows([manual]).map((r) => r.id)).toEqual([8]);
  });

  test("archived query contract includes fields required by Archived panel", () => {
    const row = {
      id: 9,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      archived_at: "2026-07-10T12:00:00.000Z",
      updated_at: "2026-07-10T12:00:00.000Z",
      created_at: "2026-06-01T12:00:00.000Z",
      title: "Coastal Home",
    };
    const [panelRow] = filterArchivedListingsPanelRows([row]);
    expect(panelRow.archived_at).toBeTruthy();
    expect(panelRow.title).toBe("Coastal Home");
  });
});
