/** @jest-environment jsdom */

import { readVisualModeCache, writeVisualModeCache } from "./visualModeCache";
import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";
import { PULSE_MODE_KEY } from "../utils/pulseMode";

describe("visualModeCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("writeVisualModeCache persists palette and pulse only", () => {
    writeVisualModeCache({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 1.25,
    });

    expect(window.localStorage.getItem(LIVE_PALETTE_MODE_KEY)).toBe("1");
    expect(window.localStorage.getItem(PULSE_MODE_KEY)).toBe("0");
    expect(window.localStorage.getItem("blz_sea_flow_mode_v1")).toBeNull();
    expect(window.localStorage.getItem("blz_sea_flow_intensity_v1")).toBeNull();
  });

  test("readVisualModeCache purges legacy sea flow keys", () => {
    window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, "0");
    window.localStorage.setItem(PULSE_MODE_KEY, "1");
    window.localStorage.setItem("blz_sea_flow_mode_v1", "1");
    window.localStorage.setItem("blz_sea_flow_intensity_v1", "2");

    expect(readVisualModeCache()).toEqual({
      livePalette: false,
      pulse: true,
    });
    expect(window.localStorage.getItem("blz_sea_flow_mode_v1")).toBeNull();
  });
});
