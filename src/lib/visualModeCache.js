import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";
import { PULSE_MODE_KEY } from "../utils/pulseMode";
import { SEA_FLOW_MODE_KEY } from "../utils/seaFlowMode";
import { SEA_FLOW_INTENSITY_KEY } from "../utils/seaFlowIntensity";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "./visualModeConfig";

/** Read optional client cache — not authoritative; bootstrap hint only. */
export function readVisualModeCache() {
  if (typeof window === "undefined") return { ...VISUAL_MODE_DEFAULTS };
  return normalizeVisualModeConfig({
    livePalette: window.localStorage.getItem(LIVE_PALETTE_MODE_KEY) === "1",
    pulse: window.localStorage.getItem(PULSE_MODE_KEY) === "1",
    seaFlow: window.localStorage.getItem(SEA_FLOW_MODE_KEY) === "1",
    seaFlowIntensity: window.localStorage.getItem(SEA_FLOW_INTENSITY_KEY),
  });
}

/** Persist confirmed server state to the optional client cache. */
export function writeVisualModeCache(config) {
  if (typeof window === "undefined") return;
  const normalized = normalizeVisualModeConfig(config);
  window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, normalized.livePalette ? "1" : "0");
  window.localStorage.setItem(PULSE_MODE_KEY, normalized.pulse ? "1" : "0");
  window.localStorage.setItem(SEA_FLOW_MODE_KEY, normalized.seaFlow ? "1" : "0");
  window.localStorage.setItem(SEA_FLOW_INTENSITY_KEY, String(normalized.seaFlowIntensity));
}
