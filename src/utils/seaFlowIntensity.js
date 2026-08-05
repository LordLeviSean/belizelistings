export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";

/** 50% — visible baseline (prior-generation maximum strength) */
export const SEA_FLOW_INTENSITY_DEFAULT = 0.5;
export const SEA_FLOW_INTENSITY_MAX = 5;
export const SEA_FLOW_INTENSITY_STOPS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];

/** Prior calibration maximum (stored 5.0) — new 50% baseline targets these strengths. */
export const SEA_FLOW_PREVIOUS_MAX_VISUAL = Object.freeze({
  opacityA: 0.52,
  opacityB: 0.45,
  motion: 3.2,
  speed: 2.2,
  blurA: 96,
  blurB: 118,
  drift: 4.2,
  saturate: 1.68,
  glow: 0.76,
  brightness: 1.08,
});

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
 * Visual tier: 1.0 at 50% (prior maximum) → ~2.4 at 500%.
 * Stored server values remain 0.5–5.0; tier drives presentation only.
 */
export function normalizeSeaFlowIntensityTier(intensity) {
  const raw = clampSeaFlowIntensity(intensity);
  const span = SEA_FLOW_INTENSITY_MAX - SEA_FLOW_INTENSITY_DEFAULT;
  const linear = span > 0 ? Math.max(0, (raw - SEA_FLOW_INTENSITY_DEFAULT) / span) : 0;
  return 1 + Math.pow(linear, 0.78) * 1.4;
}

/** @deprecated alias — tier replaces prior power curve */
export function normalizeSeaFlowIntensityPower(intensity) {
  return normalizeSeaFlowIntensityTier(intensity);
}

/**
 * Derived CSS variables for Sea Flow presentation layers.
 * Tier 1.0 ≈ prior-generation 500% appearance (new 50% baseline).
 */
export function computeSeaFlowIntensityVisualVars(intensity) {
  const raw = snapSeaFlowIntensity(intensity);
  const tier = normalizeSeaFlowIntensityTier(raw);
  const rise = tier - 1;
  const prev = SEA_FLOW_PREVIOUS_MAX_VISUAL;

  const opacityDark = Math.min(0.94, 0.58 + 0.26 * rise);
  const opacityLight = Math.min(0.88, 0.5 + 0.24 * rise);
  const opacityGlow = Math.min(0.82, 0.36 + 0.3 * rise);

  return {
    "--sea-flow-intensity": String(raw),
    "--sea-flow-power": tier.toFixed(4),
    "--sea-flow-tier": tier.toFixed(4),
    "--sea-flow-drift": (prev.drift * tier).toFixed(4),
    "--sea-flow-motion": (prev.motion * tier).toFixed(4),
    "--sea-flow-blur-a": `${Math.round(prev.blurA + 54 * rise)}px`,
    "--sea-flow-blur-b": `${Math.round(prev.blurB + 64 * rise)}px`,
    "--sea-flow-opacity-a": opacityDark.toFixed(4),
    "--sea-flow-opacity-b": opacityLight.toFixed(4),
    "--sea-flow-opacity-dark": opacityDark.toFixed(4),
    "--sea-flow-opacity-light": opacityLight.toFixed(4),
    "--sea-flow-opacity-glow": opacityGlow.toFixed(4),
    "--sea-flow-speed": (prev.speed + 1.4 * rise).toFixed(4),
    "--sea-flow-saturate": (prev.saturate + 0.55 * rise).toFixed(4),
    "--sea-flow-glow": Math.min(1, prev.glow + 0.34 * rise).toFixed(4),
    "--sea-flow-brightness": (prev.brightness + 0.16 * rise).toFixed(4),
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

/** CSS custom property payload for homepage Sea Flow layers */
export function seaFlowIntensityStyle(intensity) {
  return computeSeaFlowIntensityVisualVars(intensity);
}

/** Minified bootstrap helper — must stay in sync with computeSeaFlowIntensityVisualVars. */
export function getSeaFlowIntensityBootstrapScriptBody() {
  return (
    "function blzApplySeaFlowVars(el,si){var r=Math.min(5,Math.max(0,parseFloat(si)||0.5));" +
    "var lin=Math.max(0,(r-0.5)/4.5);var t=1+Math.pow(lin,0.78)*1.4;var rise=t-1;" +
    "var od=Math.min(0.94,0.58+0.26*rise);var ol=Math.min(0.88,0.5+0.24*rise);var og=Math.min(0.82,0.36+0.3*rise);" +
    'el.style.setProperty("--sea-flow-intensity",String(r));' +
    'el.style.setProperty("--sea-flow-power",t.toFixed(4));' +
    'el.style.setProperty("--sea-flow-tier",t.toFixed(4));' +
    'el.style.setProperty("--sea-flow-drift",(4.2*t).toFixed(4));' +
    'el.style.setProperty("--sea-flow-motion",(3.2*t).toFixed(4));' +
    'el.style.setProperty("--sea-flow-blur-a",Math.round(96+54*rise)+"px");' +
    'el.style.setProperty("--sea-flow-blur-b",Math.round(118+64*rise)+"px");' +
    'el.style.setProperty("--sea-flow-opacity-a",od.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-b",ol.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-dark",od.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-light",ol.toFixed(4));' +
    'el.style.setProperty("--sea-flow-opacity-glow",og.toFixed(4));' +
    'el.style.setProperty("--sea-flow-speed",(2.2+1.4*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-saturate",(1.68+0.55*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-glow",Math.min(1,0.76+0.34*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-brightness",(1.08+0.16*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-brightness-dark",Math.max(0.68,(0.9-0.2*rise)).toFixed(4));' +
    'el.style.setProperty("--sea-flow-contrast",(1.1+0.18*rise).toFixed(4));' +
    'el.style.setProperty("--sea-flow-gradient-strength",Math.min(1.42,(1.04+0.28*rise)).toFixed(4));}'
  );
}
