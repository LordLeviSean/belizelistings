import { readVisualModeCache } from "../lib/visualModeCache";

export const LIVE_PALETTE_MODE_KEY = "blz_live_palette_mode_v1";
export const LIVE_PALETTE_MODE_EVENT = "blz-live-palette-mode-change";

/** Read optional client cache (server config overrides via VisualModeProvider). */
export function readLivePaletteMode() {
  return readVisualModeCache().livePalette;
}

/** Cache-only write for tests/bootstrap helpers — not an admin write path. */
export function writeLivePaletteMode(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(LIVE_PALETTE_MODE_EVENT, { detail: { enabled: Boolean(enabled) } })
  );
}
