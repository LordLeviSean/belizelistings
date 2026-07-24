/** @jest-environment node */

import {
  buildRecentlyRentedFallback,
  buildRecentlyRentedPatch,
  buildRecentlySoldFallback,
  buildRecentlySoldPatch,
  RECENTLY_RENTED_STATUS_TIERS,
  RECENTLY_SOLD_STATUS_TIERS,
} from "./listingWriteContract";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";

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
});
