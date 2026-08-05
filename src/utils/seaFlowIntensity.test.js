/** @jest-environment node */

import {
  SEA_FLOW_INTENSITY_DEFAULT,
  SEA_FLOW_INTENSITY_MAX,
  SEA_FLOW_PREVIOUS_MAX_VISUAL,
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

  test("maps major intensity steps to progressively higher visual tier", () => {
    const steps = [0.5, 1, 2, 3, 4, 5].map(normalizeSeaFlowIntensityTier);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(steps[0]).toBeCloseTo(1, 2);
    expect(steps[steps.length - 1]).toBeGreaterThan(2);
  });

  test("new 50% baseline is at least as strong as previous 500% maximum", () => {
    const baseline = computeSeaFlowIntensityVisualVars(0.5);
    const prev = SEA_FLOW_PREVIOUS_MAX_VISUAL;

    expect(Number(baseline["--sea-flow-opacity-dark"])).toBeGreaterThanOrEqual(prev.opacityA);
    expect(Number(baseline["--sea-flow-opacity-light"])).toBeGreaterThanOrEqual(prev.opacityB);
    expect(Number(baseline["--sea-flow-motion"])).toBeGreaterThanOrEqual(prev.motion);
    expect(Number(baseline["--sea-flow-speed"])).toBeGreaterThanOrEqual(prev.speed);
    expect(parseInt(baseline["--sea-flow-blur-a"], 10)).toBeGreaterThanOrEqual(prev.blurA);
    expect(parseInt(baseline["--sea-flow-blur-b"], 10)).toBeGreaterThanOrEqual(prev.blurB);
  });

  test("calculated visual variables are materially stronger at 5.0 than 0.5", () => {
    const baseline = computeSeaFlowIntensityVisualVars(0.5);
    const extreme = computeSeaFlowIntensityVisualVars(5);

    expect(Number(extreme["--sea-flow-opacity-dark"])).toBeGreaterThan(
      Number(baseline["--sea-flow-opacity-dark"]) + 0.15
    );
    expect(Number(extreme["--sea-flow-speed"])).toBeGreaterThan(
      Number(baseline["--sea-flow-speed"]) + 0.8
    );
    expect(Number(extreme["--sea-flow-motion"])).toBeGreaterThan(
      Number(baseline["--sea-flow-motion"]) * 1.8
    );
    expect(parseInt(extreme["--sea-flow-blur-a"], 10)).toBeGreaterThan(
      parseInt(baseline["--sea-flow-blur-a"], 10) + 40
    );
  });

  test("seaFlowIntensityStyle exposes derived vars for live CSS updates", () => {
    const style = seaFlowIntensityStyle(3);
    expect(style["--sea-flow-intensity"]).toBe("3");
    expect(style["--sea-flow-tier"]).toBeTruthy();
    expect(style["--sea-flow-opacity-dark"]).toBeTruthy();
    expect(style["--sea-flow-opacity-light"]).toBeTruthy();
    expect(style["--sea-flow-opacity-glow"]).toBeTruthy();
    expect(style["--sea-flow-speed"]).toBeTruthy();
    expect(style["--sea-flow-motion"]).toBeTruthy();
  });
});
