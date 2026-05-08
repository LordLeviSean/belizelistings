import {
  getLifecycleStatus,
  getModerationStatus,
  getListingRegionSlug,
} from "./canonicalListing";

describe("canonicalListing", () => {
  test("prefers lifecycle_status over legacy status", () => {
    expect(getLifecycleStatus({ lifecycle_status: "archived", status: "approved" })).toBe("archived");
    expect(getLifecycleStatus({ status: "pending" })).toBe("pending");
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
});

