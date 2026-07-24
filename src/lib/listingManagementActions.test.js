/** @jest-environment node */

import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { resolveListingManagementActions } from "@/lib/listingManagementActions";

const OWNER = "owner-1";

function publishedSale(overrides = {}) {
  return {
    id: 1,
    user_id: OWNER,
    status: "approved",
    lifecycle_status: "published",
    listing_type: "sale",
    ...overrides,
  };
}

function publishedRent(overrides = {}) {
  return {
    id: 2,
    user_id: OWNER,
    status: "approved",
    lifecycle_status: "published",
    listing_type: "rent",
    ...overrides,
  };
}

describe("resolveListingManagementActions", () => {
  test("published sale owner listing shows View, Edit, Mark Sold, Archive", () => {
    const mgmt = resolveListingManagementActions(publishedSale(), { viewerUserId: OWNER });
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(true);
    expect(mgmt.completionAction.action?.label).toBe("Mark Sold");
  });

  test("published rental owner listing shows View, Edit, Mark Rented, Archive", () => {
    const mgmt = resolveListingManagementActions(publishedRent(), { viewerUserId: OWNER });
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(true);
    expect(mgmt.completionAction.action?.label).toBe("Mark Rented");
  });

  test("unknown-market published listing still shows View, Edit, Archive", () => {
    const mgmt = resolveListingManagementActions(
      publishedSale({ listing_type: null, market_type: null }),
      { viewerUserId: OWNER }
    );
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(false);
    expect(mgmt.completionAction.action).toBeNull();
  });

  test("missing market field does not collapse owner permissions", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 3,
        user_id: OWNER,
        status: "approved",
        lifecycle_status: "published",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.isOwner).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(false);
  });

  test("non-owner cannot edit or archive published listing", () => {
    const mgmt = resolveListingManagementActions(publishedSale(), { viewerUserId: "stranger" });
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(false);
    expect(mgmt.canArchive).toBe(false);
    expect(mgmt.completionAction.visible).toBe(false);
  });

  test("rejected listing retains edit, resubmit, and archive actions", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 4,
        user_id: OWNER,
        status: "rejected",
        lifecycle_status: "rejected",
        listing_type: "sale",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canResubmit).toBe(true);
    expect(mgmt.lifecycle).toBe(LISTING_LIFECYCLE.REJECTED);
    expect(mgmt.completionAction.visible).toBe(false);
  });

  test("draft listing shows discard controls only", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 5,
        user_id: OWNER,
        status: "draft",
        lifecycle_status: "draft",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.canView).toBe(false);
    expect(mgmt.canDiscardDraft).toBe(true);
    expect(mgmt.canEdit).toBe(false);
    expect(mgmt.canArchive).toBe(false);
  });

  test("recently rented listing shows View, Edit, Archive now — not Mark Rented", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 6,
        user_id: OWNER,
        status: "approved",
        lifecycle_status: "recently_rented",
        listing_type: "rent",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(false);
    expect(mgmt.isRecentlyClosed).toBe(true);
  });

  test("recently sold listing shows View, Edit, Archive now — not Mark Sold", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 7,
        user_id: OWNER,
        status: "approved",
        lifecycle_status: "recently_sold",
        listing_type: "sale",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.canView).toBe(true);
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(false);
  });

  test("approved-only row without lifecycle_status still resolves published actions", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 8,
        user_id: OWNER,
        status: "approved",
        listing_type: "rent",
      },
      { viewerUserId: OWNER }
    );
    expect(mgmt.isPublished).toBe(true);
    expect(mgmt.completionAction.visible).toBe(true);
  });
});
