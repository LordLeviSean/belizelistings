import { LISTING_HEALTH_TIER } from "../constants/operationalIntel";
import { LISTING_LIFECYCLE } from "../constants/operationalModel";
import {
  collectListingImageUrls,
  analyzeImageHeuristics,
  evaluateListingIntel,
  buildAgentActivityFeed,
} from "./listingIntel";

describe("listingIntel", () => {
  test("collectListingImageUrls from listing_images", () => {
    const urls = collectListingImageUrls({
      listing_images: [{ image_url: "/a.png" }, { image_url: "/b.png" }],
    });
    expect(urls.length).toBe(2);
    expect(urls[0]).toContain("a.png");
  });

  test("analyzeImageHeuristics flags empty photos", () => {
    const r = analyzeImageHeuristics({});
    expect(r.count).toBe(0);
    expect(r.warnings.some((w) => w.code === "no_photos")).toBe(true);
  });

  test("evaluateListingIntel critical without photos", () => {
    const intel = evaluateListingIntel({
      id: "1",
      status: LISTING_LIFECYCLE.PUBLISHED,
      title: "Test",
      price: 100000,
      district: "belize",
      property_type: "house",
      description: "x".repeat(50),
      listing_images: [],
    });
    expect(intel.healthTier).toBe(LISTING_HEALTH_TIER.CRITICAL);
  });

  test("land inventory skips residential description length warnings", () => {
    const intel = evaluateListingIntel({
      id: "2",
      status: LISTING_LIFECYCLE.DRAFT,
      title: "Parcel",
      price: 50000,
      district: "belize",
      property_type: "land",
      description: "short",
      listing_images: [{ image_url: "/a.png" }, { image_url: "/b.png" }],
    });
    expect(intel.warnings.some((w) => w.code === "short_description" && w.severity === "critical")).toBe(
      false
    );
  });

  test("buildAgentActivityFeed picks rejected state", () => {
    const feed = buildAgentActivityFeed([
      {
        id: "z",
        title: "Z",
        status: LISTING_LIFECYCLE.REJECTED,
        updated_at: new Date().toISOString(),
      },
    ]);
    expect(feed.length).toBe(1);
    expect(feed[0].tone).toBe("rejected");
  });
});
