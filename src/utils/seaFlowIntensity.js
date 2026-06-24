export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";
export const SEA_FLOW_INTENSITY_DEFAULT = 0.5;
export const SEA_FLOW_INTENSITY_STOPS = [0, 0.25, 0.5, 0.75, 1];

export const SEA_FLOW_INTENSITY_LABELS = {
  0: "Disabled",
  0.25: "Subtle",
  0.5: "Default",
  0.75: "Pronounced",
  1: "Cinematic",
};

export function clampSeaFlowIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEA_FLOW_INTENSITY_DEFAULT;
  return Math.min(1, Math.max(0, n));
}

export function getSeaFlowIntensityLabel(intensity) {
  const pct = Math.round(clampSeaFlowIntensity(intensity) * 100);
  const stop = SEA_FLOW_INTENSITY_STOPS.find((s) => Math.round(s * 100) === pct);
  if (stop != null && SEA_FLOW_INTENSITY_LABELS[stop]) {
    return `${pct} · ${SEA_FLOW_INTENSITY_LABELS[stop]}`;
  }
  return `${pct}%`;
}

export function readSeaFlowIntensity() {
  if (typeof window === "undefined") return SEA_FLOW_INTENSITY_DEFAULT;
  const raw = window.localStorage.getItem(SEA_FLOW_INTENSITY_KEY);
  if (raw == null || raw === "") return SEA_FLOW_INTENSITY_DEFAULT;
  return clampSeaFlowIntensity(raw);
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

/** Nearest slider stop (0, 0.25, …) for admin + QA consistency */
export function snapSeaFlowIntensity(intensity) {
  const t = clampSeaFlowIntensity(intensity);
  const pct = Math.round(t * 100);
  let best = SEA_FLOW_INTENSITY_STOPS[0];
  let bestDelta = Math.abs(Math.round(best * 100) - pct);
  for (const stop of SEA_FLOW_INTENSITY_STOPS) {
    const delta = Math.abs(Math.round(stop * 100) - pct);
    if (delta < bestDelta) {
      best = stop;
      bestDelta = delta;
    }
  }
  return best;
}

/** CSS custom property payload for hero canvas (--sea-flow-intensity is primary driver) */
export function seaFlowIntensityStyle(intensity) {
  const t = snapSeaFlowIntensity(intensity);
  return { "--sea-flow-intensity": t };
}
