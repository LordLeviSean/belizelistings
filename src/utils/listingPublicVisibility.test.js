/** @jest-environment node */

import { filterListings } from "./filterListings";
import {
  filterActiveInventory,
  filterBrowsableInventory,
  isListingActivelyAvailable,
  isListingEngagementEnabled,
  isListingPubliclyVisible,
  isRecentlyClosedPublicListing,
} from "./canonicalListing";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";

describe("listing public visibility predicates", () => {
  const now = Date.parse("2026-07-10T12:00:00.000Z");

  const recentlyRented = {
    id: 1,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
    rented_at: "2026-07-10T11:59:00.000Z",
    listing_type: "rent",
  };

  const recentlySold = {
    id: 2,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
    sold_at: "2026-07-10T11:59:00.000Z",
    listing_type: "sale",
  };

  const publishedRent = {
    id: 3,
    status: "approved",
    lifecycle_status: "published",
    listing_type: "rent",
  };

  test("recently_rented is publicly visible before expiry", () => {
    expect(isListingPubliclyVisible(recentlyRented, now)).toBe(true);
    expect(isRecentlyClosedPublicListing(recentlyRented, now)).toBe(true);
  });

  test("recently_sold is publicly visible before expiry", () => {
    expect(isListingPubliclyVisible(recentlySold, now)).toBe(true);
  });

  test("recently closed rows without close timestamps remain publicly visible", () => {
    const row = {
      id: 4,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
      updated_at: "2026-07-10T11:58:00.000Z",
      listing_type: "rent",
    };
    expect(isListingPubliclyVisible(row, now)).toBe(true);
  });

  test("recently_rented is excluded from active rental counts", () => {
    const rows = [publishedRent, recentlyRented];
    expect(filterActiveInventory(rows).map((r) => r.id)).toEqual([3]);
    expect(isListingActivelyAvailable(recentlyRented)).toBe(false);
  });

  test("recently_sold is excluded from active sale counts", () => {
    expect(isListingActivelyAvailable(recentlySold)).toBe(false);
  });

  test("recently closed listings reject engagement", () => {
    expect(isListingEngagementEnabled(recentlyRented)).toBe(false);
    expect(isListingEngagementEnabled(recentlySold)).toBe(false);
    expect(isListingEngagementEnabled(publishedRent)).toBe(true);
  });

  test("recently closed listing appears in All Listings market filter", () => {
    const rows = [recentlyRented, publishedRent];
    expect(
      filterListings(rows, { status: "all" }).map((listing) => listing.id)
    ).toEqual([1, 3]);
  });

  test("recently closed listing does not appear in active For Rent results", () => {
    const rows = [recentlyRented, publishedRent];
    expect(filterListings(rows, { status: "rent" }).map((listing) => listing.id)).toEqual([3]);
  });

  test("recently closed listing does not appear in active For Sale results", () => {
    const publishedSale = {
      id: 7,
      status: "approved",
      lifecycle_status: "published",
      listing_type: "sale",
    };
    const rows = [recentlySold, publishedSale];
    expect(filterListings(rows, { status: "for-sale" }).map((listing) => listing.id)).toEqual([7]);
  });

  test("archived listing is removed from normal public browse", () => {
    const archived = { id: 5, status: "archived", lifecycle_status: "archived" };
    expect(isListingPubliclyVisible(archived, now)).toBe(false);
    expect(filterBrowsableInventory([archived, publishedRent], now).map((r) => r.id)).toEqual([3]);
  });

  test("visibility expires consistently with configured duration", () => {
    const expired = {
      id: 6,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-07T12:00:00.000Z",
    };
    expect(isListingPubliclyVisible(expired, now)).toBe(false);
  });

  test("favorites/browse filter retains recently closed rows within window", () => {
    expect(filterBrowsableInventory([recentlyRented, recentlySold], now).map((r) => r.id)).toEqual([
      1, 2,
    ]);
  });
});
