/** @jest-environment jsdom */

import { readVisualModeCache, writeVisualModeCache } from "./visualModeCache";
import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";

describe("visualModeCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("writeVisualModeCache persists confirmed server state", () => {
    writeVisualModeCache({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 1.25,
    });

    expect(window.localStorage.getItem(LIVE_PALETTE_MODE_KEY)).toBe("1");
    expect(readVisualModeCache()).toEqual({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 1.25,
    });
  });

  test("stale cache is readable but normalized", () => {
    window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, "1");
    window.localStorage.setItem("blz_pulse_mode_v1", "0");
    window.localStorage.setItem("blz_sea_flow_mode_v1", "1");
    window.localStorage.setItem("blz_sea_flow_intensity_v1", "1.25");

    expect(readVisualModeCache().livePalette).toBe(true);
    expect(readVisualModeCache().seaFlowIntensity).toBe(1.25);
  });
});
