/** @jest-environment node */

import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import {
  LISTING_BADGE_VARIANT,
  resolveListingLifecycleBadge,
} from "./listingLifecycleBadge";

describe("resolveListingLifecycleBadge", () => {
  test("active sale listing shows For Sale", () => {
    const badge = resolveListingLifecycleBadge({
      status: "approved",
      lifecycle_status: "published",
      listing_type: "sale",
    });
    expect(badge).toEqual({ label: "For Sale", variant: LISTING_BADGE_VARIANT.SALE });
  });

  test("recently rented listing shows Rented immediately", () => {
    const badge = resolveListingLifecycleBadge({
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
      listing_type: "rent",
    });
    expect(badge).toEqual({ label: "Rented", variant: LISTING_BADGE_VARIANT.RENTED });
  });

  test("recently sold listing shows Sold immediately", () => {
    const badge = resolveListingLifecycleBadge({
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      listing_type: "sale",
    });
    expect(badge).toEqual({ label: "Sold", variant: LISTING_BADGE_VARIANT.SOLD });
  });
});
