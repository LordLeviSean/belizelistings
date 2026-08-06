export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";

/** Admin slider minimum — 50% baseline appearance */
export const SEA_FLOW_INTENSITY_MIN = 0.5;
export const SEA_FLOW_INTENSITY_DEFAULT = 0.5;
/** Admin slider maximum — 150% peak energy */
export const SEA_FLOW_INTENSITY_MAX = 1.5;
export const SEA_FLOW_INTENSITY_STOPS = [0.5, 0.75, 1, 1.25, 1.5];

/** Visual constants at tier 1.0 (50% baseline). */
export const SEA_FLOW_BASE_VISUAL = Object.freeze({
  opacityA: 0.42,
  opacityB: 0.36,
  motion: 1,
  speed: 1,
  blurA: 80,
  blurB: 96,
  drift: 1.6,
  saturate: 1.32,
  glow: 0.52,
  brightness: 1.04,
});

export const SEA_FLOW_INTENSITY_LABELS = {
  0.5: "Baseline",
  0.75: "Light",
  1: "Moderate",
  1.25: "Strong",
  1.5: "Maximum",
};

export function clampSeaFlowIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEA_FLOW_INTENSITY_DEFAULT;
  return Math.min(SEA_FLOW_INTENSITY_MAX, Math.max(SEA_FLOW_INTENSITY_MIN, n));
}

/** Slider/admin percent (50–150) → stored server intensity (0.5–1.5). */
export function seaFlowIntensityFromPercent(percent) {
  return clampSeaFlowIntensity(Number(percent) / 100);
}

/** Stored intensity (0.5–1.5) → admin slider percent (50–150). */
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

/** Nearest 5% step (50–150%) for admin slider consistency */
export function snapSeaFlowIntensity(intensity) {
  const t = clampSeaFlowIntensity(intensity);
  const pct = Math.round(t * 100);
  const snappedPct = Math.round(pct / 5) * 5;
  return clampSeaFlowIntensity(snappedPct / 100);
}

/**
 * Visual tier: 1.0 at 50% baseline → ~2.4 at 150%.
 * Stored server values remain 0.5–1.5; tier drives presentation only.
 */
export function normalizeSeaFlowIntensityTier(intensity) {
  const raw = clampSeaFlowIntensity(intensity);
  const span = SEA_FLOW_INTENSITY_MAX - SEA_FLOW_INTENSITY_MIN;
  const linear = span > 0 ? Math.max(0, (raw - SEA_FLOW_INTENSITY_MIN) / span) : 0;
  return 1 + Math.pow(linear, 0.78) * 1.4;
}

/** @deprecated alias — tier replaces prior power curve */
export function normalizeSeaFlowIntensityPower(intensity) {
  return normalizeSeaFlowIntensityTier(intensity);
}

/** Derived CSS variables for Sea Flow presentation layers. */
export function computeSeaFlowIntensityVisualVars(intensity) {
  const raw = snapSeaFlowIntensity(intensity);
  const tier = normalizeSeaFlowIntensityTier(raw);
  const rise = tier - 1;
  const base = SEA_FLOW_BASE_VISUAL;

  const opacityDark = Math.min(0.94, base.opacityA + 0.26 * rise);
  const opacityLight = Math.min(0.88, base.opacityB + 0.24 * rise);
  const opacityGlow = Math.min(0.82, base.glow * 0.7 + 0.3 * rise);

  return {
    "--sea-flow-intensity": String(raw),
    "--sea-flow-power": tier.toFixed(4),
    "--sea-flow-tier": tier.toFixed(4),
    "--sea-flow-drift": (base.drift * tier).toFixed(4),
    "--sea-flow-motion": (base.motion * tier).toFixed(4),
    "--sea-flow-blur-a": `${Math.round(base.blurA + 54 * rise)}px`,
    "--sea-flow-blur-b": `${Math.round(base.blurB + 64 * rise)}px`,
    "--sea-flow-opacity-a": opacityDark.toFixed(4),
    "--sea-flow-opacity-b": opacityLight.toFixed(4),
    "--sea-flow-opacity-dark": opacityDark.toFixed(4),
    "--sea-flow-opacity-light": opacityLight.toFixed(4),
    "--sea-flow-opacity-glow": opacityGlow.toFixed(4),
    "--sea-flow-speed": (base.speed + 1.4 * rise).toFixed(4),
    "--sea-flow-saturate": (base.saturate + 0.55 * rise).toFixed(4),
    "--sea-flow-glow": Math.min(1, base.glow + 0.34 * rise).toFixed(4),
    "--sea-flow-brightness": (base.brightness + 0.16 * rise).toFixed(4),
    "--sea-flow-brightness-dark": Math.max(0.68, 0.9 - 0.2 * rise).toFixed(4),
    "--sea-flow-contrast": (1.1 + 0.18 * rise).toFixed(4),
    "--sea-flow-gradient-strength": Math.min(1.42, 1.04 + 0.28 * rise).toFixed(4),
  };
}

export function applySeaFlowIntensityVarsToElement(element, intensity) {
  if (!element?.style) return;
  const vars = computeSeaFlowIntensityVisualVars(intensity);
  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

/** CSS custom property payload for Sea Flow layers */
export function seaFlowIntensityStyle(intensity) {
  return computeSeaFlowIntensityVisualVars(intensity);
}

/** Minified bootstrap helper — must stay in sync with computeSeaFlowIntensityVisualVars. */
export function getSeaFlowIntensityBootstrapScriptBody() {
  return (
    "function blzApplySeaFlowVars(el,si){var r=Math.min(1.5,Math.max(0.5,parseFloat(si)||0.5));" +
    "var lin=Math.max(0,(r-0.5)/1);var t=1+Math.pow(lin,0.78)*1.4;var rise=t-1;" +
    "var od=Math.min(0.94,0.42+0.26*rise);var ol=Math.min(0.88,0.36+0.24*rise);var og=Math.min(0.82,0.364+0.3*rise);" +
    'el.style.setProperty("--sea-flow-intensity",String(r));' +
    'el.style.setProperty("--sea-flow-power",t.toFixed(4));' +
    'el.style.setProperty("--sea-flow-tier",t.toFixed(4));' +
    'el.style.setProperty("--sea-flow-drift",(1.6*t).toFixed(4));' +
    'el.style.setProperty("--sea-flow-motion",(1*t).toFixed(4));' +
    'el.style.setProperty("--sea-flow-blur-a",Math.round(80+54*rise)+"px");' +
    'el.style.setProperty("--sea-flow-blur-b",Math.round(96+64*rise)+"px");' +
    'el.style.setProperty("--sea-flow-opacity-a",od.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-b",ol.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-dark",od.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-light",ol.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-glow",og.toFixed(4));' +
    'el.style.setProperty("--sea-flow-speed",(1+1.4*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-saturate",(1.32+0.55*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-glow",Math.min(1,0.52+0.34*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-brightness",(1.04+0.16*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-brightness-dark",Math.max(0.68,(0.9-0.2*rise)).toFixed(4));' +
    'el.style.setProperty("--sea-flow-contrast",(1.1+0.18*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-gradient-strength",Math.min(1.42,(1.04+0.28*rise)).toFixed(4));}'
  );
}
