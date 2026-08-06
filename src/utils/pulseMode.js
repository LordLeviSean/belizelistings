import { readVisualModeCache } from "../lib/visualModeCache";

export const PULSE_MODE_KEY = "blz_pulse_mode_v1";
export const PULSE_MODE_EVENT = "blz-pulse-mode-change";

export function readPulseMode() {
  return readVisualModeCache().pulse;
}

export function writePulseMode(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PULSE_MODE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(PULSE_MODE_EVENT, { detail: { enabled: Boolean(enabled) } })
  );
}
