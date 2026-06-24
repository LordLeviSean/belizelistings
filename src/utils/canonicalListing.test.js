import {
  getLifecycleStatus,
  getModerationStatus,
  getListingRegionSlug,
  isPubliclyVisibleListing,
  filterPublicInventory,
  normalizeOperationalLifecycle,
  tallyOperationalLifecycleCounts,
  OPERATIONAL_LIFECYCLE_BUCKET,
} from "./canonicalListing";

describe("canonicalListing", () => {
  test("prefers lifecycle_status over legacy status", () => {
    expect(getLifecycleStatus({ lifecycle_status: "archived", status: "approved" })).toBe("archived");
    expect(getLifecycleStatus({ status: "pending" })).toBe("pending");
  });

  test("submit-for-review: submitted lifecycle and stale draft lifecycle resolve to pending", () => {
    expect(
      getLifecycleStatus({
        status: "pending",
        lifecycle_status: "submitted",
        moderation_status: "pending_review",
      })
    ).toBe("pending");
    expect(
      getLifecycleStatus({
        status: "pending",
        lifecycle_status: "draft",
        moderation_status: "pending_review",
      })
    ).toBe("pending");
  });

  test("resolves moderation status with fallback", () => {
    expect(getModerationStatus({ moderation_status: "approved" })).toBe("approved");
    expect(getModerationStatus({ status: "pending" })).toBe("pending_review");
    expect(getModerationStatus({ status: "draft" })).toBe("unknown");
  });

  test("prefers canonical region_slug with district fallback", () => {
    expect(getListingRegionSlug({ region_slug: "san-pedro", district: "belize" })).toBe("san-pedro");
    expect(getListingRegionSlug({ district: "stann creek" })).toBe("stann-creek");
  });

  test("prefers subregion_slug over region_slug for listing location", () => {
    expect(
      getListingRegionSlug({
        region_slug: "ambergris-caye",
        subregion_slug: "san-pedro",
        district: "ambergris-caye",
      })
    ).toBe("san-pedro");
  });

  test("free-agent cap: archived rows use lifecycle or legacy status", () => {
    expect(getLifecycleStatus({ status: "archived" })).toBe("archived");
    expect(getLifecycleStatus({ lifecycle_status: "archived", status: "approved" })).toBe("archived");
    expect(getLifecycleStatus({ status: "pending" })).toBe("pending");
  });

  test("split-brain: legacy archived beats stale lifecycle pending", () => {
    expect(
      getLifecycleStatus({ lifecycle_status: "pending", status: "archived", moderation_status: "pending_review" })
    ).toBe("archived");
  });

  test("lifecycle_status published resolves to approved inventory", () => {
    expect(
      getLifecycleStatus({
        status: "approved",
        lifecycle_status: "published",
        moderation_status: "approved",
      })
    ).toBe("approved");
    expect(
      normalizeOperationalLifecycle({
        id: 1,
        status: "approved",
        lifecycle_status: "published",
        moderation_status: "approved",
      })
    ).toBe(OPERATIONAL_LIFECYCLE_BUCKET.APPROVED);
    expect(isPubliclyVisibleListing({ id: 1, lifecycle_status: "published", status: "approved" })).toBe(
      true
    );
  });

  test("isPubliclyVisibleListing: only canonical published", () => {
    expect(isPubliclyVisibleListing({ id: 1, status: "approved" })).toBe(true);
    expect(isPubliclyVisibleListing({ id: 2, status: "approved", moderation_status: "archived" })).toBe(false);
    expect(isPubliclyVisibleListing({ id: 3, status: "approved", lifecycle_status: "archived" })).toBe(false);
    expect(isPubliclyVisibleListing({ id: 4, status: "pending" })).toBe(false);
    expect(isPubliclyVisibleListing({ id: 5, status: "rejected" })).toBe(false);
    expect(isPubliclyVisibleListing(null)).toBe(false);
  });

  test("filterPublicInventory drops non-public rows", () => {
    const rows = [
      { id: 1, status: "approved" },
      { id: 2, status: "archived" },
      { id: 3, status: "approved", moderation_status: "archived" },
    ];
    expect(filterPublicInventory(rows).map((r) => r.id)).toEqual([1]);
  });

  test("normalizeOperationalLifecycle: pending, approved, rejected, archived vs excluded", () => {
    expect(normalizeOperationalLifecycle({ id: 1, status: "pending" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.PENDING);
    expect(normalizeOperationalLifecycle({ id: 2, status: "approved" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.APPROVED);
    expect(normalizeOperationalLifecycle({ id: 3, status: "archived" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.ARCHIVED);
    expect(normalizeOperationalLifecycle({ id: 4, status: "rejected" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.REJECTED);
    expect(normalizeOperationalLifecycle({ id: 5, status: "draft" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.EXCLUDED);
    expect(normalizeOperationalLifecycle({ id: 6, status: "verified" })).toBe(OPERATIONAL_LIFECYCLE_BUCKET.EXCLUDED);
    expect(normalizeOperationalLifecycle(null)).toBe(OPERATIONAL_LIFECYCLE_BUCKET.EXCLUDED);
  });

  test("tallyOperationalLifecycleCounts: disjoint buckets and total equals sum", () => {
    const rows = [
      { id: 1, status: "pending" },
      { id: 2, status: "approved" },
      { id: 3, status: "archived" },
      { id: 4, status: "draft" },
      { id: 5, status: "approved", moderation_status: "archived" },
      { id: 6, status: "rejected" },
    ];
    const t = tallyOperationalLifecycleCounts(rows);
    expect(t.pending).toBe(1);
    expect(t.approved).toBe(1);
    expect(t.rejected).toBe(1);
    expect(t.archived).toBe(2);
    expect(t.totalOperational).toBe(t.pending + t.approved + t.rejected + t.archived);
  });
});

