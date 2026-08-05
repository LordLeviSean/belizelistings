import { readVisualModeCache } from "./visualModeCache";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "./visualModeConfig";

/** Snapshot from optional client cache (bootstrap hint — server config overrides). */
export function readVisualModeState() {
  return readVisualModeCache();
}

function clearLegacySeaFlowDocumentState(root) {
  delete root.dataset.seaFlow;
  for (let i = root.style.length - 1; i >= 0; i -= 1) {
    const prop = root.style[i];
    if (prop?.startsWith("--sea-flow")) {
      root.style.removeProperty(prop);
    }
  }
}

/** Apply visual-mode state to the document root for global CSS + flash-free bootstrap. */
export function syncVisualModeDocument(state = readVisualModeState()) {
  if (typeof document === "undefined") return;

  const normalized = normalizeVisualModeConfig(state);
  const root = document.documentElement;
  root.dataset.livePalette = normalized.livePalette ? "true" : "false";
  root.dataset.pulseMode = normalized.pulse ? "true" : "false";
  clearLegacySeaFlowDocumentState(root);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
}

/** Inline bootstrap for _document — reads optional cache before first paint. */
export function getVisualModeBootstrapScript() {
  return `(function(){try{var lp=localStorage.getItem("blz_live_palette_mode_v1")==="1";var pm=localStorage.getItem("blz_pulse_mode_v1")==="1";var el=document.documentElement;el.setAttribute("data-live-palette",lp?"true":"false");el.setAttribute("data-pulse-mode",pm?"true":"false");el.removeAttribute("data-sea-flow");try{localStorage.removeItem("blz_sea_flow_mode_v1");localStorage.removeItem("blz_sea_flow_intensity_v1");}catch(e){}for(var i=el.style.length-1;i>=0;i--){var p=el.style[i];if(p&&p.indexOf("--sea-flow")===0){el.style.removeProperty(p);}}var rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;el.setAttribute("data-reduced-motion",rm?"true":"false");}catch(e){}})();`;
}

export { VISUAL_MODE_DEFAULTS };
