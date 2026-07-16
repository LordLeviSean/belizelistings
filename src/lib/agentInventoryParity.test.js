/** @jest-environment node */

import { resolveListingEditHref } from "@/lib/listingEditAccess";
import { OWNERSHIP_ACTIONS } from "@/constants/ownershipModel";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { resolveListingCompletionAction } from "@/lib/listingCompletionAction";
import { resolveListingManagementActions } from "@/lib/listingManagementActions";

describe("agent inventory parity contracts", () => {
  test("agent edit uses canonical resolveListingEditHref", () => {
    expect(resolveListingEditHref(99)).toBe("/dashboard/create?draft=99");
    expect(resolveListingEditHref(99, { resubmit: true })).toBe(
      "/dashboard/create?draft=99&resubmit=1"
    );
  });

  test("mark sold and mark rented lifecycle actions match owner panel", () => {
    expect(OWNERSHIP_ACTIONS.CLOSE_SOLD).toBe("close_sold");
    expect(OWNERSHIP_ACTIONS.CLOSE_RENTED).toBe("close_rented");
    expect(OWNERSHIP_ACTIONS.ARCHIVE).toBe("archive");
    expect(LISTING_LIFECYCLE.RECENTLY_SOLD).toBe("recently_sold");
    expect(LISTING_LIFECYCLE.RECENTLY_RENTED).toBe("recently_rented");
  });

  test("shared completion resolver drives agent inventory labels", () => {
    expect(resolveListingCompletionAction({ listing_type: "sale" })?.label).toBe("Mark Sold");
    expect(resolveListingCompletionAction({ listing_type: "rent" })?.label).toBe("Mark Rented");
  });

  test("agent inventory keeps edit and archive when market is unknown", () => {
    const mgmt = resolveListingManagementActions(
      {
        id: 9,
        user_id: "agent-1",
        status: "approved",
        lifecycle_status: "published",
      },
      { viewerUserId: "agent-1" }
    );
    expect(mgmt.canEdit).toBe(true);
    expect(mgmt.canArchive).toBe(true);
    expect(mgmt.completionAction.visible).toBe(false);
  });
});
