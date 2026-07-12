import {
  deriveUserDashboardListingCounts,
  filterArchivedListingsPanelRows,
  filterMyListingsPanelRows,
  filterPendingListingsPanelRows,
  isCreateWorkspaceEditableListing,
} from "./userDashboardListingTruth";

describe("userDashboardListingTruth", () => {
  test("deriveUserDashboardListingCounts: active excludes pending for cap math", () => {
    const rows = [
      { id: 1, status: "approved" },
      { id: 2, status: "approved" },
      { id: 3, status: "approved" },
      { id: 4, status: "approved" },
      { id: 5, status: "pending", moderation_status: "pending_review", lifecycle_status: "pending" },
      { id: 6, status: "draft" },
      { id: 7, status: "archived" },
      { id: 8, status: "rejected" },
    ];
    const c = deriveUserDashboardListingCounts(rows);
    expect(c.activeListings).toBe(4);
    expect(c.pendingListings).toBe(1);
    expect(c.draftListings).toBe(1);
    expect(c.archivedListings).toBe(1);
    expect(c.rejectedListings).toBe(1);
  });

  test("deriveUserDashboardListingCounts: submitted lifecycle counts as pending not draft", () => {
    const rows = [
      {
        id: 9,
        status: "pending",
        lifecycle_status: "submitted",
        moderation_status: "pending_review",
      },
      { id: 10, status: "draft", lifecycle_status: "draft" },
    ];
    const c = deriveUserDashboardListingCounts(rows);
    expect(c.pendingListings).toBe(1);
    expect(c.draftListings).toBe(1);
  });

  test("panel filters split pending, archived, and my listings", () => {
    const rows = [
      { id: 1, status: "approved" },
      { id: 2, status: "pending" },
      { id: 3, status: "draft" },
      { id: 4, status: "archived" },
    ];
    expect(filterPendingListingsPanelRows(rows).map((r) => r.id)).toEqual([2]);
    expect(filterArchivedListingsPanelRows(rows).map((r) => r.id)).toEqual([4]);
    expect(filterMyListingsPanelRows(rows).map((r) => r.id)).toEqual([1, 3]);
  });

  test("isCreateWorkspaceEditableListing: draft, rejected, archived, published, pending, recently closed", () => {
    expect(isCreateWorkspaceEditableListing({ id: 1, status: "draft" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 2, status: "rejected" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 3, status: "archived" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 4, status: "approved" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 5, status: "pending" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 6, status: "recently_sold", sold_at: "2026-07-01" })).toBe(true);
  });
});
