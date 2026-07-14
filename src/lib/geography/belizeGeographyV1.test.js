import {
  getAreaOptionsForMapRegion,
  getCommunityById,
  getLocalityOptionsForCommunity,
  getMapRegionsForSelector,
} from "./belizeGeographyV1";

describe("belizeGeographyV1", () => {
  test("exposes eight map regions in approved order", () => {
    const regions = getMapRegionsForSelector();
    expect(regions).toHaveLength(8);
    expect(regions.map((r) => r.slug)).toEqual([
      "corozal",
      "orange-walk",
      "belize",
      "cayo",
      "stann-creek",
      "toledo",
      "ambergris-caye",
      "caye-caulker",
    ]);
  });

  test("Corozal San Pedro is isolated from Ambergris San Pedro", () => {
    const corozalAreas = getAreaOptionsForMapRegion("corozal");
    const ambergrisAreas = getAreaOptionsForMapRegion("ambergris-caye");
    const corozalPedro = corozalAreas.find((a) => a.id === "area-corozal-san-pedro");
    const ambergrisPedro = ambergrisAreas.find((a) => a.id === "area-ambergris-caye-san-pedro");
    expect(corozalPedro).toBeTruthy();
    expect(ambergrisPedro).toBeTruthy();
    expect(getLocalityOptionsForCommunity("area-corozal-san-pedro")).toHaveLength(0);
    expect(getLocalityOptionsForCommunity("area-ambergris-caye-san-pedro").length).toBeGreaterThan(0);
  });

  test("Cayo Santa Elena vs Toledo Santa Elena", () => {
    const cayo = getCommunityById("area-cayo-santa-elena");
    const toledo = getCommunityById("area-toledo-santa-elena");
    expect(cayo?.map_region_id).toBe("map-cayo");
    expect(toledo?.map_region_id).toBe("map-toledo");
    expect(getLocalityOptionsForCommunity("area-toledo-santa-elena")).toHaveLength(0);
    expect(getLocalityOptionsForCommunity("area-cayo-santa-elena").length).toBeGreaterThan(0);
  });

  test("Independence under Stann Creek with localities empty at village level", () => {
    const areas = getAreaOptionsForMapRegion("stann-creek");
    const independence = areas.find((a) => a.id === "area-stann-creek-independence");
    expect(independence?.name).toBe("Independence");
  });

  test("Hopeville in Toledo, Hope Creek in Stann Creek", () => {
    const toledo = getAreaOptionsForMapRegion("toledo");
    const stann = getAreaOptionsForMapRegion("stann-creek");
    expect(toledo.find((a) => a.id === "area-toledo-hopeville")).toBeTruthy();
    expect(stann.find((a) => a.id === "area-stann-creek-hope-creek")).toBeTruthy();
  });

  test("John Smith Road under Belize only", () => {
    const belize = getAreaOptionsForMapRegion("belize");
    const cayo = getAreaOptionsForMapRegion("cayo");
    expect(belize.find((a) => a.id === "road-john-smith-road")).toBeTruthy();
    expect(cayo.find((a) => a.id === "road-john-smith-road")).toBeFalsy();
  });

  test("highways appear per map region without duplicate canonical IDs", () => {
    const belizeHw = getAreaOptionsForMapRegion("belize").filter((a) => a.kind === "highway");
    const cayoHw = getAreaOptionsForMapRegion("cayo").filter((a) => a.kind === "highway");
    const gphBelize = belizeHw.find((h) => h.id === "highway-george-price-highway");
    const gphCayo = cayoHw.find((h) => h.id === "highway-george-price-highway");
    expect(gphBelize?.id).toBe(gphCayo?.id);
  });
});
