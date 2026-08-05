/** @jest-environment node */

import {
  normalizeVisualModeConfig,
  parseBooleanConfigValue,
  validateVisualModePatch,
  VISUAL_MODE_DEFAULTS,
} from "./visualModeConfig";

describe("visualModeConfig", () => {
  test("returns safe defaults for empty input", () => {
    expect(normalizeVisualModeConfig()).toEqual(VISUAL_MODE_DEFAULTS);
  });

  test("parses RPC payload booleans and intensity", () => {
    expect(
      normalizeVisualModeConfig({
        livePalette: true,
        pulse: "1",
        seaFlow: false,
        seaFlowIntensity: "1.5",
      })
    ).toEqual({
      livePalette: true,
      pulse: true,
      seaFlow: false,
      seaFlowIntensity: 1.5,
    });
  });

  test("validateVisualModePatch rejects invalid booleans", () => {
    expect(() =>
      validateVisualModePatch({
        livePalette: "maybe",
        pulse: false,
        seaFlow: false,
        seaFlowIntensity: 0.5,
      })
    ).toThrow(/Boolean visual-mode fields/);
  });

  test("validateVisualModePatch rejects out-of-range intensity", () => {
    expect(() =>
      validateVisualModePatch({
        livePalette: false,
        pulse: false,
        seaFlow: false,
        seaFlowIntensity: 6,
      })
    ).toThrow(/between 0 and 5/);
  });

  test("parseBooleanConfigValue handles common truthy/falsy values", () => {
    expect(parseBooleanConfigValue("1")).toBe(true);
    expect(parseBooleanConfigValue("0")).toBe(false);
    expect(parseBooleanConfigValue("true")).toBe(true);
    expect(parseBooleanConfigValue(null)).toBe(null);
  });
});
