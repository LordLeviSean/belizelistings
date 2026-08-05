import { BELIZE_MAP_REGION_CONFIG } from "@/constants/belizeMapRegions";
import {
  TIP_EST_H,
  TIP_EST_W,
  TIP_PAD,
  regionCenterClient,
  resolveMapRegionLabel,
  tooltipPosition,
} from "./belizeMapTooltip";

describe("tooltipPosition", () => {
  const viewport = { width: 1440, height: 900 };

  test("offsets from cursor by default", () => {
    const pos = tooltipPosition(400, 300, viewport);
    expect(pos.left).toBeGreaterThan(400);
    expect(pos.top).toBeGreaterThan(300);
  });

  test("flips left when near right edge", () => {
    const pos = tooltipPosition(1300, 400, viewport);
    expect(pos.left).toBeLessThan(1300);
    expect(pos.left).toBeGreaterThanOrEqual(TIP_PAD);
  });

  test("flips up when near bottom edge", () => {
    const pos = tooltipPosition(400, 860, viewport);
    expect(pos.top).toBeLessThan(860);
    expect(pos.top).toBeGreaterThanOrEqual(TIP_PAD);
  });

  test("stays within viewport bounds", () => {
    const pos = tooltipPosition(10, 10, viewport);
    expect(pos.left).toBeGreaterThanOrEqual(TIP_PAD);
    expect(pos.top).toBeGreaterThanOrEqual(TIP_PAD);
    expect(pos.left + TIP_EST_W).toBeLessThanOrEqual(viewport.width - TIP_PAD);
    expect(pos.top + TIP_EST_H).toBeLessThanOrEqual(viewport.height - TIP_PAD);
  });
});

describe("resolveMapRegionLabel", () => {
  test("returns canonical mainland names without District suffix", () => {
    expect(resolveMapRegionLabel({ regionId: "belize", regionLabel: "Belize" })).toBe("Belize");
    expect(resolveMapRegionLabel({ regionId: "cayo", regionLabel: "Cayo" })).toBe("Cayo");
    expect(resolveMapRegionLabel({ regionId: "corozal", regionLabel: "Corozal" })).toBe("Corozal");
    expect(resolveMapRegionLabel({ regionId: "orange_walk", regionLabel: "Orange Walk" })).toBe(
      "Orange Walk"
    );
    expect(resolveMapRegionLabel({ regionId: "stann_creek", regionLabel: "Stann Creek" })).toBe(
      "Stann Creek"
    );
    expect(resolveMapRegionLabel({ regionId: "toledo", regionLabel: "Toledo" })).toBe("Toledo");
  });

  test("returns full island names", () => {
    expect(
      resolveMapRegionLabel({ regionId: "ambergris_caye", regionLabel: "Ambergris Caye" })
    ).toBe("Ambergris Caye");
    expect(
      resolveMapRegionLabel({ regionId: "caye_caulker", regionLabel: "Caye Caulker" })
    ).toBe("Caye Caulker");
  });

  test("all eight interactive regions use geographyLayer labels", () => {
    const expected = [
      "Corozal",
      "Orange Walk",
      "Belize",
      "Cayo",
      "Stann Creek",
      "Toledo",
      "Ambergris Caye",
      "Caye Caulker",
    ];
    const labels = Object.entries(BELIZE_MAP_REGION_CONFIG)
      .filter(([id]) => id !== "mainland_base")
      .map(([, cfg]) => cfg.label);
    expect(labels.sort()).toEqual(expected.sort());
  });
});

describe("regionCenterClient", () => {
  test("returns null when group or svg is missing", () => {
    expect(regionCenterClient(null, null)).toBeNull();
  });
});
