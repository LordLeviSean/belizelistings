/** @jest-environment node */

import { LISTING_LIFECYCLE, getLifecycleLabel } from "@/constants/operationalModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { resolveListingLifecycleBadge } from "@/lib/listingLifecycleBadge";
import { resolveLifecycleStatusBadgeSuffix } from "@/lib/dashboardStatusBadges";
import { buildListingDashboardSelect } from "@/lib/listingDashboardSelectContract";
import { tallyOperationalLifecycleCounts } from "@/utils/canonicalListing";

const OWNER = "owner-1";

function recentlyRentedRow(overrides = {}) {
  return {
    id: 101,
    user_id: OWNER,
    status: "approved",
    lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
    listing_type: "rent",
    closed_at: "2026-07-24T12:00:00.000Z",
    rented_at: "2026-07-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("listing lifecycle synchronization", () => {
  test("admin and user resolve identical badges from the same listing row", () => {
    const row = recentlyRentedRow();
    const lifecycle = getLifecycleStatus(row);
    expect(getLifecycleLabel(lifecycle)).toBe("Rented");
    expect(resolveListingLifecycleBadge(row).label).toBe("Rented");
    expect(resolveLifecycleStatusBadgeSuffix(lifecycle)).toBe("RecentlyRented");
  });

  test("status approved does not override lifecycle recently_rented visually", () => {
    const row = recentlyRentedRow();
    expect(getLifecycleStatus(row)).toBe(LISTING_LIFECYCLE.RECENTLY_RENTED);
    expect(getLifecycleLabel(getLifecycleStatus(row))).toBe("Rented");
    expect(resolveListingLifecycleBadge(row).label).not.toBe("Published");
  });

  test("owner dashboard minimal select includes lifecycle fields", () => {
    const minimal = buildListingDashboardSelect({ minimal: true });
    expect(minimal).toContain("lifecycle_status");
    expect(minimal).toContain("closed_at");
  });

  test("active counts exclude recently closed listings", () => {
    const counts = tallyOperationalLifecycleCounts([
      recentlyRentedRow(),
      {
        id: 102,
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      },
    ]);
    expect(counts.approved).toBe(1);
  });

  test("degraded owner row without lifecycle_status falls back to published", () => {
    const degraded = { id: 103, user_id: OWNER, status: "approved", listing_type: "rent" };
    expect(getLifecycleStatus(degraded)).toBe(LISTING_LIFECYCLE.PUBLISHED);
  });

  test("hydrated owner row with lifecycle_status resolves rented immediately", () => {
    expect(getLifecycleStatus(recentlyRentedRow())).toBe(LISTING_LIFECYCLE.RECENTLY_RENTED);
  });
});
