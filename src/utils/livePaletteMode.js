export const LIVE_PALETTE_MODE_KEY = "blz_live_palette_mode_v1";
export const LIVE_PALETTE_MODE_EVENT = "blz-live-palette-mode-change";

export function readLivePaletteMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LIVE_PALETTE_MODE_KEY) === "1";
}

export function writeLivePaletteMode(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIVE_PALETTE_MODE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(LIVE_PALETTE_MODE_EVENT, { detail: { enabled: Boolean(enabled) } })
  );
}

