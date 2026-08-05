import { LIVE_PALETTE_MODE_KEY } from "../utils/livePaletteMode";
import { PULSE_MODE_KEY } from "../utils/pulseMode";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "./visualModeConfig";

const LEGACY_SEA_FLOW_MODE_KEY = "blz_sea_flow_mode_v1";
const LEGACY_SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";

function purgeLegacySeaFlowStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_SEA_FLOW_MODE_KEY);
  window.localStorage.removeItem(LEGACY_SEA_FLOW_INTENSITY_KEY);
}

/** Read optional client cache — not authoritative; bootstrap hint only. */
export function readVisualModeCache() {
  if (typeof window === "undefined") return { ...VISUAL_MODE_DEFAULTS };
  purgeLegacySeaFlowStorage();
  return normalizeVisualModeConfig({
    livePalette: window.localStorage.getItem(LIVE_PALETTE_MODE_KEY) === "1",
    pulse: window.localStorage.getItem(PULSE_MODE_KEY) === "1",
  });
}

/** Persist confirmed server state to the optional client cache. */
export function writeVisualModeCache(config) {
  if (typeof window === "undefined") return;
  const normalized = normalizeVisualModeConfig(config);
  window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, normalized.livePalette ? "1" : "0");
  window.localStorage.setItem(PULSE_MODE_KEY, normalized.pulse ? "1" : "0");
  purgeLegacySeaFlowStorage();
}
