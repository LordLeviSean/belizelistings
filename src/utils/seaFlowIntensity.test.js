/** @jest-environment node */

import {
  SEA_FLOW_INTENSITY_DEFAULT,
  SEA_FLOW_INTENSITY_MAX,
  SEA_FLOW_INTENSITY_MIN,
  SEA_FLOW_BASE_VISUAL,
  clampSeaFlowIntensity,
  computeSeaFlowIntensityVisualVars,
  normalizeSeaFlowIntensityTier,
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

  test("converts admin slider 150% to stored 1.5", () => {
    expect(seaFlowIntensityFromPercent(150)).toBe(1.5);
    expect(seaFlowIntensityToPercent(1.5)).toBe(150);
  });

  test("clamps out-of-range values to 50–150% band", () => {
    expect(clampSeaFlowIntensity(5)).toBe(SEA_FLOW_INTENSITY_MAX);
    expect(clampSeaFlowIntensity(0)).toBe(SEA_FLOW_INTENSITY_MIN);
    expect(snapSeaFlowIntensity(1.23)).toBe(1.25);
    expect(seaFlowIntensityStyle(1.5)["--sea-flow-intensity"]).toBe("1.5");
  });

  test("keeps valid intensity limits enforced at 0.5 and 1.5", () => {
    expect(clampSeaFlowIntensity(SEA_FLOW_INTENSITY_MIN)).toBe(0.5);
    expect(clampSeaFlowIntensity(99)).toBe(SEA_FLOW_INTENSITY_MAX);
    expect(clampSeaFlowIntensity(Number.NaN)).toBe(SEA_FLOW_INTENSITY_DEFAULT);
  });

  test("maps major intensity steps to progressively higher visual tier", () => {
    const steps = [0.5, 0.75, 1, 1.25, 1.5].map(normalizeSeaFlowIntensityTier);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(steps[0]).toBeCloseTo(1, 2);
    expect(steps[steps.length - 1]).toBeGreaterThan(2);
  });

  test("50% baseline uses moderate base visual constants", () => {
    const baseline = computeSeaFlowIntensityVisualVars(0.5);
    const base = SEA_FLOW_BASE_VISUAL;

    expect(Number(baseline["--sea-flow-motion"])).toBeCloseTo(base.motion, 1);
    expect(Number(baseline["--sea-flow-speed"])).toBeCloseTo(base.speed, 1);
    expect(parseInt(baseline["--sea-flow-blur-a"], 10)).toBeGreaterThanOrEqual(base.blurA - 2);
  });

  test("calculated visual variables are materially stronger at 150% than 50%", () => {
    const baseline = computeSeaFlowIntensityVisualVars(0.5);
    const peak = computeSeaFlowIntensityVisualVars(1.5);

    expect(Number(peak["--sea-flow-opacity-dark"])).toBeGreaterThan(
      Number(baseline["--sea-flow-opacity-dark"]) + 0.1
    );
    expect(Number(peak["--sea-flow-speed"])).toBeGreaterThan(
      Number(baseline["--sea-flow-speed"]) + 0.8
    );
    expect(Number(peak["--sea-flow-motion"])).toBeGreaterThan(
      Number(baseline["--sea-flow-motion"]) * 1.8
    );
    expect(parseInt(peak["--sea-flow-blur-a"], 10)).toBeGreaterThan(
      parseInt(baseline["--sea-flow-blur-a"], 10) + 30
    );
  });

  test("seaFlowIntensityStyle exposes derived vars for live CSS updates", () => {
    const style = seaFlowIntensityStyle(1);
    expect(style["--sea-flow-intensity"]).toBe("1");
    expect(style["--sea-flow-tier"]).toBeTruthy();
    expect(style["--sea-flow-opacity-dark"]).toBeTruthy();
    expect(style["--sea-flow-opacity-light"]).toBeTruthy();
    expect(style["--sea-flow-opacity-glow"]).toBeTruthy();
    expect(style["--sea-flow-speed"]).toBeTruthy();
    expect(style["--sea-flow-motion"]).toBeTruthy();
  });
});
