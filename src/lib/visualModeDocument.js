import { readVisualModeCache } from "./visualModeCache";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "./visualModeConfig";
import { SEA_FLOW_INTENSITY_DEFAULT } from "../utils/seaFlowIntensity";

/** Snapshot from optional client cache (bootstrap hint — server config overrides). */
export function readVisualModeState() {
  return readVisualModeCache();
}

/** Apply visual-mode state to the document root for global CSS + flash-free bootstrap. */
export function syncVisualModeDocument(state = readVisualModeState()) {
  if (typeof document === "undefined") return;

  const normalized = normalizeVisualModeConfig(state);
  const root = document.documentElement;
  root.dataset.livePalette = normalized.livePalette ? "true" : "false";
  root.dataset.pulseMode = normalized.pulse ? "true" : "false";
  root.dataset.seaFlow = normalized.seaFlow ? "on" : "off";
  root.style.setProperty("--sea-flow-intensity", String(normalized.seaFlowIntensity));

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
}

/** Inline bootstrap for _document — reads optional cache before first paint. */
export function getVisualModeBootstrapScript() {
  return `(function(){try{var lp=localStorage.getItem("blz_live_palette_mode_v1")==="1";var pm=localStorage.getItem("blz_pulse_mode_v1")==="1";var sf=localStorage.getItem("blz_sea_flow_mode_v1")==="1";var si=localStorage.getItem("blz_sea_flow_intensity_v1");var el=document.documentElement;el.setAttribute("data-live-palette",lp?"true":"false");el.setAttribute("data-pulse-mode",pm?"true":"false");el.setAttribute("data-sea-flow",sf?"on":"off");el.style.setProperty("--sea-flow-intensity",si!=null&&si!==""?si:"${SEA_FLOW_INTENSITY_DEFAULT}");var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;el.setAttribute("data-reduced-motion",rm?"true":"false");}catch(e){}})();`;
}

export { VISUAL_MODE_DEFAULTS };
