export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";
import { readVisualModeCache } from "../lib/visualModeCache";

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

/** CSS custom property payload for hero canvas (--sea-flow-intensity is primary driver) */
export function seaFlowIntensityStyle(intensity) {
  const t = snapSeaFlowIntensity(intensity);
  return { "--sea-flow-intensity": t };
}
