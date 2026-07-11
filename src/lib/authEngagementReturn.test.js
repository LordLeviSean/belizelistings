/** @jest-environment node */

import { omitRouterQueryParam } from "./adminDashboardQuery";
import {
  LISTING_ENGAGEMENT_ACTIONS,
  normalizeReturnTo,
  parsePendingListingEngagement,
  serializePendingListingEngagement,
  shouldTriggerListingEngagementAction,
} from "./authEngagementReturn";

describe("authEngagementReturn", () => {
  test("normalizeReturnTo accepts internal listing paths and rejects external/login paths", () => {
    expect(normalizeReturnTo("/listing/abc-123")).toBe("/listing/abc-123");
    expect(normalizeReturnTo(["/listing/xyz"])).toBe("/listing/xyz");
    expect(normalizeReturnTo("//evil.com")).toBeNull();
    expect(normalizeReturnTo("https://evil.com")).toBeNull();
    expect(normalizeReturnTo("/login?signup=1")).toBeNull();
    expect(normalizeReturnTo("/auth/callback")).toBeNull();
  });

  test("serialize and parse pending listing engagement round-trip", () => {
    const now = Date.now();
    const raw = serializePendingListingEngagement({
      listingId: "42",
      action: LISTING_ENGAGEMENT_ACTIONS.VIEWING,
      returnPath: "/listing/42?ref=map",
      ts: now,
    });
    const parsed = parsePendingListingEngagement(raw, { maxAgeMs: 60_000 });
    expect(parsed).toEqual({
      listingId: "42",
      action: LISTING_ENGAGEMENT_ACTIONS.VIEWING,
      returnPath: "/listing/42?ref=map",
      ts: now,
    });
  });

  test("parsePendingListingEngagement enforces listing id and ttl", () => {
    const raw = serializePendingListingEngagement({
      listingId: "9",
      action: LISTING_ENGAGEMENT_ACTIONS.MESSAGE,
      ts: Date.now() - 60 * 60 * 1000,
    });
    expect(parsePendingListingEngagement(raw)).toBeNull();
    const fresh = serializePendingListingEngagement({
      listingId: "9",
      action: LISTING_ENGAGEMENT_ACTIONS.MESSAGE,
      ts: Date.now(),
    });
    expect(parsePendingListingEngagement(fresh, { listingId: "8" })).toBeNull();
    expect(parsePendingListingEngagement(fresh, { listingId: "9" })?.action).toBe(
      LISTING_ENGAGEMENT_ACTIONS.MESSAGE
    );
  });

  test("shouldTriggerListingEngagementAction matches message and viewing only", () => {
    expect(shouldTriggerListingEngagementAction(LISTING_ENGAGEMENT_ACTIONS.MESSAGE)).toBe(true);
    expect(shouldTriggerListingEngagementAction(LISTING_ENGAGEMENT_ACTIONS.VIEWING)).toBe(true);
    expect(shouldTriggerListingEngagementAction("favorite")).toBe(false);
  });

  test("omitRouterQueryParam preserves unrelated query values when stripping action", () => {
    const query = {
      tab: "users",
      action: "create-user",
      conversation: "conv-42",
      filter: ["pending", "approved"],
    };
    expect(omitRouterQueryParam(query, "action")).toEqual({
      tab: "users",
      conversation: "conv-42",
      filter: ["pending", "approved"],
    });
    expect(query.action).toBe("create-user");
  });
});
