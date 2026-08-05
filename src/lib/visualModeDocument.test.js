/** @jest-environment jsdom */

import {
  readVisualModeState,
  syncVisualModeDocument,
  getVisualModeBootstrapScript,
} from "./visualModeDocument";
import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";
import { PULSE_MODE_KEY } from "../utils/pulseMode";
import { SEA_FLOW_MODE_KEY } from "../utils/seaFlowMode";
import { SEA_FLOW_INTENSITY_KEY, SEA_FLOW_INTENSITY_DEFAULT } from "../utils/seaFlowIntensity";

describe("visualModeDocument", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-live-palette");
    document.documentElement.removeAttribute("data-pulse-mode");
    document.documentElement.removeAttribute("data-sea-flow");
    document.documentElement.style.removeProperty("--sea-flow-intensity");
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
      seaFlow: false,
      seaFlowIntensity: SEA_FLOW_INTENSITY_DEFAULT,
    });
  });

  test("readVisualModeState reads optional client cache", () => {
    window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, "1");
    window.localStorage.setItem(PULSE_MODE_KEY, "1");
    window.localStorage.setItem(SEA_FLOW_MODE_KEY, "1");
    window.localStorage.setItem(SEA_FLOW_INTENSITY_KEY, "1.5");

    expect(readVisualModeState()).toEqual({
      livePalette: true,
      pulse: true,
      seaFlow: true,
      seaFlowIntensity: 1.5,
    });
  });

  test("syncVisualModeDocument applies state to documentElement", () => {
    syncVisualModeDocument({
      livePalette: true,
      pulse: false,
      seaFlow: true,
      seaFlowIntensity: 2,
    });

    expect(document.documentElement.dataset.livePalette).toBe("true");
    expect(document.documentElement.dataset.pulseMode).toBe("false");
    expect(document.documentElement.dataset.seaFlow).toBe("on");
    expect(document.documentElement.style.getPropertyValue("--sea-flow-intensity")).toBe("2");
  });

  test("syncVisualModeDocument disables sea flow when mode is off", () => {
    syncVisualModeDocument({
      livePalette: false,
      pulse: false,
      seaFlow: false,
      seaFlowIntensity: 0.5,
    });

    expect(document.documentElement.dataset.seaFlow).toBe("off");
  });

  test("bootstrap script references production localStorage keys", () => {
    const script = getVisualModeBootstrapScript();
    expect(script).toContain(LIVE_PALETTE_MODE_KEY);
    expect(script).toContain(PULSE_MODE_KEY);
    expect(script).toContain(SEA_FLOW_MODE_KEY);
    expect(script).toContain(SEA_FLOW_INTENSITY_KEY);
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
      seaFlow: false,
      seaFlowIntensity: SEA_FLOW_INTENSITY_DEFAULT,
    });

    expect(document.documentElement.dataset.reducedMotion).toBe("true");
  });
});
