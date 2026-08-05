export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";

/** 50% — subtle default across homepage, canvas, and ambient layers */
export const SEA_FLOW_INTENSITY_DEFAULT = 0.5;
export const SEA_FLOW_INTENSITY_MAX = 5;
export const SEA_FLOW_INTENSITY_STOPS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];

export const SEA_FLOW_INTENSITY_LABELS = {
  0: "Disabled",
  0.25: "Very subtle",
  0.5: "Subtle",
  0.75: "Light",
  1: "Baseline",
  1.5: "Enhanced",
  2: "Strong",
  3: "Pronounced",
  4: "Cinematic",
  5: "Maximum",
};

export function clampSeaFlowIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEA_FLOW_INTENSITY_DEFAULT;
  return Math.min(SEA_FLOW_INTENSITY_MAX, Math.max(0, n));
}

/** Slider/admin percent (50–500) → stored server intensity (0.5–5.0). */
export function seaFlowIntensityFromPercent(percent) {
  return clampSeaFlowIntensity(Number(percent) / 100);
}

/** Stored intensity (0.5–5.0) → admin slider percent (50–500). */
export function seaFlowIntensityToPercent(intensity) {
  return Math.round(clampSeaFlowIntensity(intensity) * 100);
}

export function getSeaFlowIntensityLabel(intensity) {
  const t = clampSeaFlowIntensity(intensity);
  const pct = Math.round(t * 100);
  const stop = SEA_FLOW_INTENSITY_STOPS.find((s) => Math.round(s * 100) === pct);
  if (stop != null && SEA_FLOW_INTENSITY_LABELS[stop]) {
    return `${pct}% · ${SEA_FLOW_INTENSITY_LABELS[stop]}`;
  }
  return `${pct}%`;
}

export function readSeaFlowIntensity() {
  const { readVisualModeCache } = require("../lib/visualModeCache");
  return readVisualModeCache().seaFlowIntensity;
}

export function writeSeaFlowIntensity(intensity) {
  if (typeof window === "undefined") return;
  const next = clampSeaFlowIntensity(intensity);
  window.localStorage.setItem(SEA_FLOW_INTENSITY_KEY, String(next));
  window.dispatchEvent(
    new CustomEvent(SEA_FLOW_INTENSITY_EVENT, {
      detail: { intensity: next },
    })
  );
}

/** Nearest 25% step (0–500%) for admin slider + QA consistency */
export function snapSeaFlowIntensity(intensity) {
  const t = clampSeaFlowIntensity(intensity);
  const pct = Math.round(t * 100);
  const snappedPct = Math.round(pct / 25) * 25;
  return clampSeaFlowIntensity(snappedPct / 100);
}

/**
 * Nonlinear perceptual power for CSS (0.12 at 50% … 1.0 at 500%).
 * Keeps the stored 0.5–5.0 range but expands visible differentiation.
 */
export function normalizeSeaFlowIntensityPower(intensity) {
  const raw = clampSeaFlowIntensity(intensity);
  const span = SEA_FLOW_INTENSITY_MAX - SEA_FLOW_INTENSITY_DEFAULT;
  const linear = span > 0 ? Math.max(0, (raw - SEA_FLOW_INTENSITY_DEFAULT) / span) : 0;
  const curved = Math.pow(linear, 0.82);
  return 0.12 + curved * 0.88;
}

/**
 * Derived CSS variables for Sea Flow presentation layers.
 * Raw intensity remains on --sea-flow-intensity for server parity.
 */
export function computeSeaFlowIntensityVisualVars(intensity) {
  const raw = snapSeaFlowIntensity(intensity);
  const power = normalizeSeaFlowIntensityPower(raw);

  return {
    "--sea-flow-intensity": String(raw),
    "--sea-flow-power": power.toFixed(4),
    "--sea-flow-drift": (0.42 + 3.78 * power).toFixed(4),
    "--sea-flow-motion": (0.38 + 2.82 * power).toFixed(4),
    "--sea-flow-blur-a": `${Math.round(14 + 82 * power)}px`,
    "--sea-flow-blur-b": `${Math.round(20 + 98 * power)}px`,
    "--sea-flow-opacity-a": (0.06 + 0.46 * power).toFixed(4),
    "--sea-flow-opacity-b": (0.05 + 0.4 * power).toFixed(4),
    "--sea-flow-speed": (0.42 + 1.78 * power).toFixed(4),
    "--sea-flow-saturate": (1 + 0.68 * power).toFixed(4),
    "--sea-flow-glow": (0.14 + 0.62 * power).toFixed(4),
    "--sea-flow-brightness": (0.86 + 0.22 * power).toFixed(4),
  };
}

export function applySeaFlowIntensityVarsToElement(element, intensity) {
  if (!element?.style) return;
  const vars = computeSeaFlowIntensityVisualVars(intensity);
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

/** CSS custom property payload for homepage Sea Flow layers */
export function seaFlowIntensityStyle(intensity) {
  return computeSeaFlowIntensityVisualVars(intensity);
}

/** Minified bootstrap helper — must stay in sync with computeSeaFlowIntensityVisualVars. */
export function getSeaFlowIntensityBootstrapScriptBody() {
  return (
    "function blzApplySeaFlowVars(el,si){var r=Math.min(5,Math.max(0,parseFloat(si)||0.5));" +
    "var lin=Math.max(0,(r-0.5)/4.5);var p=0.12+Math.pow(lin,0.82)*0.88;" +
    'el.style.setProperty("--sea-flow-intensity",String(r));' +
    'el.style.setProperty("--sea-flow-power",p.toFixed(4));' +
    'el.style.setProperty("--sea-flow-drift",(0.42+3.78*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-motion",(0.38+2.82*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-blur-a",Math.round(14+82*p)+"px");' +
    'el.style.setProperty("--sea-flow-blur-b",Math.round(20+98*p)+"px");' +
    'el.style.setProperty("--sea-flow-opacity-a",(0.06+0.46*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-b",(0.05+0.4*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-speed",(0.42+1.78*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-saturate",(1+0.68*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-glow",(0.14+0.62*p).toFixed(4));' +
    'el.style.setProperty("--sea-flow-brightness",(0.86+0.22*p).toFixed(4));}'
  );
}
