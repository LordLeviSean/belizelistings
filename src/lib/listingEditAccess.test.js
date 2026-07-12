/** @jest-environment node */

import {
  canUserEditListingRow,
  isCreateWorkspaceEditableListing,
  isDirectSaveEditLifecycle,
  requiresSubmitForReviewFlow,
  resolveEditAutosaveLifecycleFields,
  resolveListingEditHref,
} from "./listingEditAccess";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";

describe("listingEditAccess", () => {
  test("resolveListingEditHref builds canonical create-workspace edit URL", () => {
    expect(resolveListingEditHref("abc-123")).toBe("/dashboard/create?draft=abc-123");
    expect(resolveListingEditHref("abc-123", { resubmit: true })).toBe(
      "/dashboard/create?draft=abc-123&resubmit=1"
    );
  });

  test("isCreateWorkspaceEditableListing includes published and recently closed inventory", () => {
    expect(isCreateWorkspaceEditableListing({ id: 1, status: "approved" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 2, status: "pending" })).toBe(true);
    expect(isCreateWorkspaceEditableListing({ id: 3, status: "recently_sold", sold_at: "2026-07-01" })).toBe(
      true
    );
    expect(isCreateWorkspaceEditableListing({ id: 4, status: "draft" })).toBe(true);
  });

  test("canUserEditListingRow allows owner and admin", () => {
    const row = { id: 1, status: "approved", user_id: "owner-1" };
    expect(canUserEditListingRow({ row, userId: "owner-1" })).toBe(true);
    expect(canUserEditListingRow({ row, userId: "stranger" })).toBe(false);
    expect(canUserEditListingRow({ row, userId: "stranger", isAdmin: true })).toBe(true);
  });

  test("canUserEditListingRow allows assigned manager", () => {
    const row = { id: 1, status: "approved", user_id: "owner-1", managed_by: "agent-9" };
    expect(canUserEditListingRow({ row, userId: "agent-9" })).toBe(true);
  });

  test("resolveEditAutosaveLifecycleFields preserves published lifecycle", () => {
    expect(resolveEditAutosaveLifecycleFields(LISTING_LIFECYCLE.PUBLISHED)).toEqual({});
    expect(resolveEditAutosaveLifecycleFields(LISTING_LIFECYCLE.RECENTLY_SOLD)).toEqual({});
  });

  test("resolveEditAutosaveLifecycleFields keeps draft and archived behavior", () => {
    expect(resolveEditAutosaveLifecycleFields(LISTING_LIFECYCLE.DRAFT).status).toBe("draft");
    expect(resolveEditAutosaveLifecycleFields(LISTING_LIFECYCLE.ARCHIVED).status).toBe("archived");
  });

  test("direct save vs submit flows split by lifecycle", () => {
    expect(isDirectSaveEditLifecycle(LISTING_LIFECYCLE.PUBLISHED)).toBe(true);
    expect(requiresSubmitForReviewFlow(LISTING_LIFECYCLE.DRAFT)).toBe(true);
    expect(requiresSubmitForReviewFlow(LISTING_LIFECYCLE.PUBLISHED)).toBe(false);
  });
});
