import {
  getAreaOptionsForMapRegion,
  getLocalityOptionsForCommunity,
  getMapRegionOptionsForSelector,
  MAP_REGION_SELECTOR_ORDER,
  validateHighwayMile,
} from "./belizeGeographyV1";

describe("belizeGeographyV1 selector order", () => {
  test("map region selector uses approved order", () => {
    const options = getMapRegionOptionsForSelector();
    expect(options.map((o) => o.id)).toEqual([...MAP_REGION_SELECTOR_ORDER]);
  });

  test("child communities sort alphabetically by display name", () => {
    const areas = getAreaOptionsForMapRegion("belize");
    const names = areas.filter((a) => a.kind === "community").map((a) => a.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(names).toEqual(sorted);
  });

  test("community labels use Name — Type format", () => {
    const areas = getAreaOptionsForMapRegion("belize");
    const belizeCity = areas.find((a) => a.id === "area-belize-belize-city");
    expect(belizeCity?.label).toBe("Belize City — City");
    const johnSmith = areas.find((a) => a.id === "road-john-smith-road");
    expect(johnSmith?.label).toBe("John Smith Road — Road Corridor");
  });

  test("highway mile is optional when empty", () => {
    const result = validateHighwayMile("highway-hummingbird-highway", "", { required: false });
    expect(result.ok).toBe(true);
    expect(result.mile).toBeNull();
  });

  test("highway mile validates when provided", () => {
    const bad = validateHighwayMile("highway-hummingbird-highway", "abc");
    expect(bad.ok).toBe(false);
    const good = validateHighwayMile("highway-hummingbird-highway", "12");
    expect(good.ok).toBe(true);
    expect(good.mile).toBe(12);
  });

  test("Corozal San Pedro options stay parent-scoped", () => {
    const areas = getAreaOptionsForMapRegion("corozal");
    const sanPedro = areas.find((a) => a.id === "area-corozal-san-pedro");
    expect(sanPedro).toBeTruthy();
    const ambergrisAreas = getAreaOptionsForMapRegion("ambergris-caye");
    expect(ambergrisAreas.find((a) => a.id === "area-corozal-san-pedro")).toBeUndefined();
  });

  test("duplicate Santa Elena communities are isolated by parent", () => {
    const toledoSantaElena = getAreaOptionsForMapRegion("toledo").find(
      (a) => a.id === "area-toledo-santa-elena"
    );
    const cayoSantaElena = getAreaOptionsForMapRegion("cayo").find(
      (a) => a.id === "area-cayo-santa-elena"
    );
    expect(toledoSantaElena).toBeTruthy();
    expect(cayoSantaElena).toBeTruthy();
    expect(getLocalityOptionsForCommunity("area-toledo-santa-elena")).toHaveLength(0);
    expect(getLocalityOptionsForCommunity("area-cayo-santa-elena").length).toBeGreaterThan(0);
  });
});
