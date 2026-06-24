export const SEA_FLOW_INTENSITY_KEY = "blz_sea_flow_intensity_v1";
export const SEA_FLOW_INTENSITY_EVENT = "blz-sea-flow-intensity-change";
export const SEA_FLOW_INTENSITY_DEFAULT = 1;
export const SEA_FLOW_INTENSITY_STOPS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];

export function clampSeaFlowIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SEA_FLOW_INTENSITY_DEFAULT;
  return Math.min(1.5, Math.max(0, n));
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
