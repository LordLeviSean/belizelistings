import { readVisualModeCache } from "../lib/visualModeCache";

export const SEA_FLOW_MODE_KEY = "blz_sea_flow_mode_v1";
export const SEA_FLOW_MODE_EVENT = "blz-sea-flow-mode-change";

export function readSeaFlowMode() {
  return readVisualModeCache().seaFlow;
}

export function writeSeaFlowMode(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEA_FLOW_MODE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(SEA_FLOW_MODE_EVENT, {
      detail: { enabled: Boolean(enabled) },
    })
  );
}
