/** @jest-environment node */

import {
  SEA_FLOW_INTENSITY_DEFAULT,
  SEA_FLOW_INTENSITY_MAX,
  clampSeaFlowIntensity,
  computeSeaFlowIntensityVisualVars,
  normalizeSeaFlowIntensityPower,
  seaFlowIntensityFromPercent,
  seaFlowIntensityStyle,
  seaFlowIntensityToPercent,
  snapSeaFlowIntensity,
} from "./seaFlowIntensity";

describe("seaFlowIntensity calibration", () => {
  test("converts admin slider 50% to stored 0.5", () => {
    expect(seaFlowIntensityFromPercent(50)).toBe(0.5);
    expect(seaFlowIntensityToPercent(0.5)).toBe(50);
  });

  test("converts admin slider 500% to stored 5.0", () => {
    expect(seaFlowIntensityFromPercent(500)).toBe(5);
    expect(seaFlowIntensityToPercent(5)).toBe(500);
  });

  test("does not clamp stored 5.0 down to 1.0", () => {
    expect(clampSeaFlowIntensity(5)).toBe(5);
    expect(snapSeaFlowIntensity(5)).toBe(5);
    expect(seaFlowIntensityStyle(5)["--sea-flow-intensity"]).toBe("5");
  });

  test("keeps valid intensity limits enforced at 0 and 5", () => {
    expect(clampSeaFlowIntensity(0)).toBe(0);
    expect(clampSeaFlowIntensity(99)).toBe(SEA_FLOW_INTENSITY_MAX);
    expect(clampSeaFlowIntensity(Number.NaN)).toBe(SEA_FLOW_INTENSITY_DEFAULT);
  });

  test("maps major intensity steps to progressively higher perceptual power", () => {
    const steps = [0.5, 1, 2, 3, 4, 5].map(normalizeSeaFlowIntensityPower);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(steps[0]).toBeCloseTo(0.12, 2);
    expect(steps[steps.length - 1]).toBeCloseTo(1, 2);
  });

  test("calculated visual variables are materially different at 0.5 and 5.0", () => {
    const subtle = computeSeaFlowIntensityVisualVars(0.5);
    const extreme = computeSeaFlowIntensityVisualVars(5);

    expect(Number(extreme["--sea-flow-opacity-a"])).toBeGreaterThan(
      Number(subtle["--sea-flow-opacity-a"]) * 2.5
    );
    expect(Number(extreme["--sea-flow-speed"])).toBeGreaterThan(
      Number(subtle["--sea-flow-speed"]) * 2
    );
    expect(Number(extreme["--sea-flow-motion"])).toBeGreaterThan(
      Number(subtle["--sea-flow-motion"]) * 2.5
    );
    expect(parseInt(extreme["--sea-flow-blur-a"], 10)).toBeGreaterThan(
      parseInt(subtle["--sea-flow-blur-a"], 10) + 40
    );
  });

  test("seaFlowIntensityStyle exposes derived vars for live CSS updates", () => {
    const style = seaFlowIntensityStyle(3);
    expect(style["--sea-flow-intensity"]).toBe("3");
    expect(style["--sea-flow-power"]).toBeTruthy();
    expect(style["--sea-flow-speed"]).toBeTruthy();
    expect(style["--sea-flow-motion"]).toBeTruthy();
  });
});
