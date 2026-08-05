/** @jest-environment jsdom */

import {
  readVisualModeState,
  syncVisualModeDocument,
  getVisualModeBootstrapScript,
} from "./visualModeDocument";
import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";
import { PULSE_MODE_KEY } from "../utils/pulseMode";

describe("visualModeDocument", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-live-palette");
    document.documentElement.removeAttribute("data-pulse-mode");
    document.documentElement.removeAttribute("data-sea-flow");
    document.documentElement.style.setProperty("--sea-flow-intensity", "5");
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("readVisualModeState returns safe defaults when storage is empty", () => {
    expect(readVisualModeState()).toEqual({
      livePalette: false,
      pulse: false,
    });
  });

  test("readVisualModeState ignores legacy sea flow cache keys", () => {
    window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, "1");
    window.localStorage.setItem(PULSE_MODE_KEY, "0");
    window.localStorage.setItem("blz_sea_flow_mode_v1", "1");
    window.localStorage.setItem("blz_sea_flow_intensity_v1", "5");

    expect(readVisualModeState()).toEqual({
      livePalette: true,
      pulse: false,
    });
    expect(window.localStorage.getItem("blz_sea_flow_mode_v1")).toBeNull();
    expect(window.localStorage.getItem("blz_sea_flow_intensity_v1")).toBeNull();
  });

  test("syncVisualModeDocument applies palette and pulse only", () => {
    syncVisualModeDocument({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 5,
    });

    expect(document.documentElement.dataset.livePalette).toBe("true");
    expect(document.documentElement.dataset.pulseMode).toBe("false");
    expect(document.documentElement.dataset.seaFlow).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--sea-flow-intensity")).toBe("");
  });

  test("bootstrap script references only live palette and pulse keys", () => {
    const script = getVisualModeBootstrapScript();
    expect(script).toContain(LIVE_PALETTE_MODE_KEY);
    expect(script).toContain(PULSE_MODE_KEY);
    expect(script).toContain('removeAttribute("data-sea-flow")');
    expect(script).not.toContain("blzApplySeaFlowVars");
    expect(script).not.toContain("--sea-flow-speed");
  });

  test("syncVisualModeDocument records reduced-motion preference", () => {
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    syncVisualModeDocument({
      livePalette: false,
      pulse: false,
    });

    expect(document.documentElement.dataset.reducedMotion).toBe("true");
  });
});
