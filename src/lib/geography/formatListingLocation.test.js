import { formatListingLocation } from "./formatListingLocation";

describe("formatListingLocation", () => {
  test("formats locality, community, district", () => {
    const label = formatListingLocation({
      map_region_slug: "belize",
      community_id: "area-belize-belize-city",
      locality_id: "loc-area-belize-belize-city-kings-park",
    });
    expect(label).toContain("King");
    expect(label).toContain("Belize City");
  });

  test("formats highway mile", () => {
    const label = formatListingLocation({
      map_region_slug: "stann-creek",
      highway_id: "highway-hummingbird-highway",
      highway_mile: 12,
    });
    expect(label).toMatch(/Mile 12/);
    expect(label).toContain("Hummingbird Highway");
  });

  test("formats Ambergris San Pedro", () => {
    const label = formatListingLocation({
      map_region_slug: "ambergris-caye",
      community_id: "area-ambergris-caye-san-pedro",
    });
    expect(label).toContain("San Pedro");
    expect(label).toContain("Ambergris Caye");
  });
});
