export const VISUAL_MODE_DB_KEYS = {
  livePalette: "live_palette_mode",
  pulse: "pulse_mode",
  /** Dormant — retained for Postgres RPC compatibility only. */
  seaFlow: "sea_flow_mode",
  seaFlowIntensity: "sea_flow_intensity",
};

export const VISUAL_MODE_PUBLIC_DB_KEYS = Object.values(VISUAL_MODE_DB_KEYS);

/** Safe production defaults when configuration cannot be loaded. */
export const VISUAL_MODE_DEFAULTS = Object.freeze({
  livePalette: false,
  pulse: false,
});

/** Sea Flow is retired — always sent on admin RPC writes; never applied in the UI. */
export const VISUAL_MODE_RETIRED_SEA_FLOW_RPC = Object.freeze({
  seaFlow: false,
  seaFlowIntensity: 0.5,
});

export function parseBooleanConfigValue(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return null;
}

/** Normalize RPC/API payload into the canonical frontend visual-mode shape. */
export function normalizeVisualModeConfig(input = {}) {
  const livePalette = parseBooleanConfigValue(input.livePalette);
  const pulse = parseBooleanConfigValue(input.pulse);

  return {
    livePalette: livePalette ?? VISUAL_MODE_DEFAULTS.livePalette,
    pulse: pulse ?? VISUAL_MODE_DEFAULTS.pulse,
  };
}

/** Merge active modes with dormant Sea Flow values for Postgres RPC. */
export function toVisualModeRpcPayload(config = {}) {
  return {
    ...normalizeVisualModeConfig(config),
    ...VISUAL_MODE_RETIRED_SEA_FLOW_RPC,
  };
}

/** Validate admin PATCH body; returns normalized config or throws. */
export function validateVisualModePatch(body = {}) {
  const missing = ["livePalette", "pulse"].filter((key) => body[key] === undefined);
  if (missing.length) {
    const err = new Error(`Missing fields: ${missing.join(", ")}`);
    err.code = "invalid_payload";
    throw err;
  }

  const livePalette = parseBooleanConfigValue(body.livePalette);
  const pulse = parseBooleanConfigValue(body.pulse);

  if (livePalette == null || pulse == null) {
    const err = new Error("Boolean visual-mode fields must be true or false");
    err.code = "invalid_boolean";
    throw err;
  }

  return {
    livePalette,
    pulse,
  };
}
