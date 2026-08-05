/** @jest-environment node */

import {
  normalizeVisualModeConfig,
  parseBooleanConfigValue,
  toVisualModeRpcPayload,
  validateVisualModePatch,
  VISUAL_MODE_DEFAULTS,
  VISUAL_MODE_RETIRED_SEA_FLOW_RPC,
} from "./visualModeConfig";

describe("visualModeConfig", () => {
  test("returns safe defaults for empty input", () => {
    expect(normalizeVisualModeConfig()).toEqual(VISUAL_MODE_DEFAULTS);
  });

  test("parses RPC payload booleans and ignores retired sea flow fields", () => {
    expect(
      normalizeVisualModeConfig({
        livePalette: true,
        pulse: "1",
        seaFlow: true,
        seaFlowIntensity: "5",
      })
    ).toEqual({
      livePalette: true,
      pulse: true,
    });
  });

  test("validateVisualModePatch accepts live palette and pulse only", () => {
    expect(
      validateVisualModePatch({
        livePalette: true,
        pulse: false,
      })
    ).toEqual({
      livePalette: true,
      pulse: false,
    });
  });

  test("validateVisualModePatch rejects invalid booleans", () => {
    expect(() =>
      validateVisualModePatch({
        livePalette: "maybe",
        pulse: false,
      })
    ).toThrow(/Boolean visual-mode fields/);
  });

  test("toVisualModeRpcPayload always sends dormant sea flow values", () => {
    expect(
      toVisualModeRpcPayload({
        livePalette: true,
        pulse: true,
        seaFlow: true,
        seaFlowIntensity: 5,
      })
    ).toEqual({
      livePalette: true,
      pulse: true,
      ...VISUAL_MODE_RETIRED_SEA_FLOW_RPC,
    });
  });

  test("parseBooleanConfigValue handles common truthy/falsy values", () => {
    expect(parseBooleanConfigValue("1")).toBe(true);
    expect(parseBooleanConfigValue("0")).toBe(false);
    expect(parseBooleanConfigValue("true")).toBe(true);
    expect(parseBooleanConfigValue(null)).toBe(null);
  });
});
