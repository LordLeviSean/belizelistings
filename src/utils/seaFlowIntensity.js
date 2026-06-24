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
