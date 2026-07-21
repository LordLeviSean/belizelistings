/** @jest-environment node */

import { validateOwnerListingPatch } from "./listingModerationBoundary";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import {
  isActiveInventoryListing,
  isBrowsableListing,
  isListingEngagementEnabled,
  isRecentlyClosedPublicListing,
} from "@/utils/canonicalListing";

describe("listingModerationBoundary", () => {
  test("owner cannot self-approve draft", () => {
    const result = validateOwnerListingPatch(
      { status: "draft", lifecycle_status: "draft" },
      { status: "approved", lifecycle_status: "published", moderation_status: "approved" }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("owner_cannot_self_approve");
  });

  test("owner cannot self-verify", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", verification_status: "unverified" },
      { status: "approved", verification_status: "verified" }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("owner_cannot_self_verify");
  });

  test("owner can mark published sale listing recently sold", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", lifecycle_status: "published", listing_type: "sale" },
      { status: "approved", lifecycle_status: "recently_sold", sold_at: "2026-07-01" }
    );
    expect(result.ok).toBe(true);
  });

  test("owner cannot mark rental listing recently sold", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", lifecycle_status: "published", listing_type: "rent" },
      { status: "approved", lifecycle_status: "recently_sold", sold_at: "2026-07-01" }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("completion_market_mismatch");
  });

  test("owner cannot mark sale listing recently rented", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", lifecycle_status: "published", listing_type: "sale" },
      { status: "approved", lifecycle_status: "recently_rented", rented_at: "2026-07-01" }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("completion_market_mismatch");
  });

  test("owner can mark published rental listing recently rented", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", lifecycle_status: "published", listing_type: "rent" },
      { status: "approved", lifecycle_status: "recently_rented", rented_at: "2026-07-01" }
    );
    expect(result.ok).toBe(true);
  });

  test("owner can edit published content without lifecycle change", () => {
    const result = validateOwnerListingPatch(
      { status: "approved", lifecycle_status: "published", title: "Old" },
      { status: "approved", lifecycle_status: "published", title: "New headline" }
    );
    expect(result.ok).toBe(true);
  });

  test("owner can resubmit rejected listing to pending", () => {
    const result = validateOwnerListingPatch(
      { status: "rejected", lifecycle_status: "rejected", moderation_status: "rejected" },
      { status: "pending", lifecycle_status: "submitted", moderation_status: "pending_review" }
    );
    expect(result.ok).toBe(true);
  });

  test("admin bypasses moderation boundary", () => {
    const result = validateOwnerListingPatch(
      { status: "draft" },
      { status: "approved", moderation_status: "approved" },
      { isAdmin: true }
    );
    expect(result.ok).toBe(true);
  });
});

describe("public visibility predicates", () => {
  const now = new Date("2026-07-10T12:00:00.000Z").getTime();

  test("published listing is browsable and engagement-enabled", () => {
    const row = { id: 1, status: "approved", lifecycle_status: "published" };
    expect(isBrowsableListing(row, now)).toBe(true);
    expect(isActiveInventoryListing(row)).toBe(true);
    expect(isListingEngagementEnabled(row)).toBe(true);
  });

  test("recently sold within window is browsable but not active inventory", () => {
    const row = {
      id: 2,
      status: "approved",
      lifecycle_status: "recently_sold",
      sold_at: "2026-07-09T12:00:00.000Z",
      closed_at: "2026-07-09T12:00:00.000Z",
    };
    expect(isRecentlyClosedPublicListing(row, now)).toBe(true);
    expect(isBrowsableListing(row, now)).toBe(true);
    expect(isActiveInventoryListing(row)).toBe(false);
    expect(isListingEngagementEnabled(row)).toBe(false);
  });

  test("archived and draft listings are hidden from browse", () => {
    expect(isBrowsableListing({ id: 3, status: "archived" }, now)).toBe(false);
    expect(isBrowsableListing({ id: 4, status: "draft" }, now)).toBe(false);
    expect(isBrowsableListing({ id: 5, status: "pending" }, now)).toBe(false);
    expect(isBrowsableListing({ id: 6, status: "rejected" }, now)).toBe(false);
  });

  test("expired recently closed window is not browsable", () => {
    const row = {
      id: 7,
      status: "approved",
      lifecycle_status: "recently_sold",
      closed_at: "2026-07-07T12:00:00.000Z",
    };
    expect(isBrowsableListing(row, now)).toBe(false);
  });
});
