/** @jest-environment node */

import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import { resolveLifecycleStatusBadgeSuffix } from "./dashboardStatusBadges";

describe("resolveLifecycleStatusBadgeSuffix", () => {
  test("maps lifecycle values to PascalCase Dashboard.module.css suffixes", () => {
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.PUBLISHED)).toBe("Approved");
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.PENDING_REVIEW)).toBe("Pending");
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.RECENTLY_SOLD)).toBe("RecentlySold");
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.RECENTLY_RENTED)).toBe("RecentlyRented");
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.ARCHIVED)).toBe("Archived");
  });

  test("handles legacy draft badge suffix", () => {
    expect(resolveLifecycleStatusBadgeSuffix(LISTING_LIFECYCLE.DRAFT, { legacyDraft: true })).toBe(
      "LegacyDraft"
    );
  });

  test("normalizes recently_sold snake_case input", () => {
    expect(resolveLifecycleStatusBadgeSuffix("recently_sold")).toBe("RecentlySold");
    expect(resolveLifecycleStatusBadgeSuffix("recently_rented")).toBe("RecentlyRented");
  });
});
