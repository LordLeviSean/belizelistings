/** @jest-environment node */

import {
  deriveDashboardCountsFromRows,
  reconcileMyListingRows,
  removeMyListingRowById,
} from "./userDashboardListingReconcile";
import {
  filterArchivedListingsPanelRows,
  filterMyListingsPanelRows,
  filterPendingListingsPanelRows,
} from "./userDashboardListingTruth";
import { getLifecycleStatus } from "../utils/canonicalListing";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";

describe("userDashboardListingReconcile", () => {
  const pendingRow = {
    id: 1,
    user_id: "owner-1",
    status: "pending",
    lifecycle_status: LISTING_LIFECYCLE.PENDING_REVIEW,
    moderation_status: "pending_review",
    updated_at: "2026-07-26T10:00:00.000Z",
    title: "Coastal Home",
  };

  test("approved moderation update removes listing from Pending and adds to My Listings", () => {
    const approvedPatch = {
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      moderation_status: "approved",
      updated_at: "2026-07-26T11:00:00.000Z",
    };
    const { rows } = reconcileMyListingRows([pendingRow], approvedPatch);

    expect(filterPendingListingsPanelRows(rows).map((r) => r.id)).toEqual([]);
    expect(filterMyListingsPanelRows(rows).map((r) => r.id)).toEqual([1]);
    expect(getLifecycleStatus(rows[0])).toBe(LISTING_LIFECYCLE.PUBLISHED);
  });

  test("rejected moderation update removes listing from Pending and surfaces rejected workflow", () => {
    const rejectedPatch = {
      id: 1,
      status: "rejected",
      lifecycle_status: LISTING_LIFECYCLE.REJECTED,
      moderation_status: "rejected",
      updated_at: "2026-07-26T11:00:00.000Z",
    };
    const { rows } = reconcileMyListingRows([pendingRow], rejectedPatch);

    expect(filterPendingListingsPanelRows(rows).map((r) => r.id)).toEqual([]);
    expect(filterMyListingsPanelRows(rows).map((r) => r.id)).toEqual([1]);
    expect(getLifecycleStatus(rows[0])).toBe(LISTING_LIFECYCLE.REJECTED);
  });

  test("pending count decrements and active count increments on approval", () => {
    const before = deriveDashboardCountsFromRows([pendingRow]);
    const { rows } = reconcileMyListingRows([pendingRow], {
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      moderation_status: "approved",
      updated_at: "2026-07-26T11:00:00.000Z",
    });
    const after = deriveDashboardCountsFromRows(rows);
    expect(before.pendingListings).toBe(1);
    expect(after.pendingListings).toBe(0);
    expect(after.activeListings).toBe(1);
  });

  test("inactive tab filters receive the same reconciled rows", () => {
    const { rows } = reconcileMyListingRows([pendingRow], {
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      moderation_status: "approved",
    });
    expect(filterPendingListingsPanelRows(rows)).toEqual([]);
    expect(filterMyListingsPanelRows(rows).length).toBe(1);
    expect(filterArchivedListingsPanelRows(rows)).toEqual([]);
  });

  test("duplicate reconcile with identical signature is a no-op", () => {
    const first = reconcileMyListingRows([pendingRow], {
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      moderation_status: "approved",
      updated_at: "2026-07-26T11:00:00.000Z",
    });
    const second = reconcileMyListingRows(first.rows, {
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      moderation_status: "approved",
      updated_at: "2026-07-26T11:00:00.000Z",
    });
    expect(second.changed).toBe(false);
    expect(second.rows).toBe(first.rows);
  });

  test("remove helper drops a row by id without duplicates", () => {
    const { rows, changed } = removeMyListingRowById([pendingRow], 1);
    expect(changed).toBe(true);
    expect(rows).toEqual([]);
  });

  test("reconcile ignores rows without id", () => {
    const { changed, rows } = reconcileMyListingRows([pendingRow], { status: "approved" });
    expect(changed).toBe(false);
    expect(rows).toEqual([pendingRow]);
  });
});
