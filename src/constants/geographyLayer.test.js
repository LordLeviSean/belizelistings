import { getRegionByAny, normalizeRegionSlug } from "./geographyLayer";

describe("geographyLayer alias resolution", () => {
  test("san pedro island resolves to San Pedro subregion, not Ambergris Caye region", () => {
    const region = getRegionByAny("san pedro island");
    expect(region).not.toBeNull();
    expect(region.slug).toBe("san-pedro");
    expect(region.type).toBe("subregion");
    expect(region.parentDistrict).toBe("ambergris-caye");
    expect(normalizeRegionSlug("san pedro island")).toBe("san-pedro");
  });

  test("ambergris caye alias still resolves to ambergris-caye region", () => {
    const region = getRegionByAny("ambergris caye");
    expect(region?.slug).toBe("ambergris-caye");
  });
});
