import { clampSeaFlowIntensity, SEA_FLOW_INTENSITY_DEFAULT } from "../utils/seaFlowIntensity";

export const VISUAL_MODE_DB_KEYS = {
  livePalette: "live_palette_mode",
  pulse: "pulse_mode",
  seaFlow: "sea_flow_mode",
  seaFlowIntensity: "sea_flow_intensity",
};

export const VISUAL_MODE_PUBLIC_DB_KEYS = Object.values(VISUAL_MODE_DB_KEYS);

/** Safe production defaults when configuration cannot be loaded. */
export const VISUAL_MODE_DEFAULTS = Object.freeze({
  livePalette: false,
  pulse: false,
  seaFlow: false,
  seaFlowIntensity: SEA_FLOW_INTENSITY_DEFAULT,
});

export function parseBooleanConfigValue(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return null;
}

/** Normalize RPC/API payload into the canonical visual-mode shape. */
export function normalizeVisualModeConfig(input = {}) {
  const livePalette = parseBooleanConfigValue(input.livePalette);
  const pulse = parseBooleanConfigValue(input.pulse);
  const seaFlow = parseBooleanConfigValue(input.seaFlow);
  const intensityRaw = input.seaFlowIntensity;

  return {
    livePalette: livePalette ?? VISUAL_MODE_DEFAULTS.livePalette,
    pulse: pulse ?? VISUAL_MODE_DEFAULTS.pulse,
    seaFlow: seaFlow ?? VISUAL_MODE_DEFAULTS.seaFlow,
    seaFlowIntensity:
      intensityRaw == null || intensityRaw === ""
        ? VISUAL_MODE_DEFAULTS.seaFlowIntensity
        : clampSeaFlowIntensity(intensityRaw),
  };
}

/** Validate admin PATCH body; returns normalized config or throws. */
export function validateVisualModePatch(body = {}) {
  const missing = ["livePalette", "pulse", "seaFlow", "seaFlowIntensity"].filter(
    (key) => body[key] === undefined
  );
  if (missing.length) {
    const err = new Error(`Missing fields: ${missing.join(", ")}`);
    err.code = "invalid_payload";
    throw err;
  }

  const livePalette = parseBooleanConfigValue(body.livePalette);
  const pulse = parseBooleanConfigValue(body.pulse);
  const seaFlow = parseBooleanConfigValue(body.seaFlow);

  if (livePalette == null || pulse == null || seaFlow == null) {
    const err = new Error("Boolean visual-mode fields must be true or false");
    err.code = "invalid_boolean";
    throw err;
  }

  const seaFlowIntensity = Number(body.seaFlowIntensity);
  if (!Number.isFinite(seaFlowIntensity)) {
    const err = new Error("seaFlowIntensity must be a number");
    err.code = "invalid_intensity";
    throw err;
  }

  const clamped = clampSeaFlowIntensity(seaFlowIntensity);
  if (clamped !== seaFlowIntensity) {
    const err = new Error("seaFlowIntensity must be between 0.5 and 1.5");
    err.code = "invalid_intensity";
    throw err;
  }

  return {
    livePalette,
    pulse,
    seaFlow,
    seaFlowIntensity: clamped,
  };
}

/** Map canonical config to Postgres RPC parameter names. */
export function toVisualModeRpcPayload(config) {
  const normalized = normalizeVisualModeConfig(config);
  return {
    livePalette: normalized.livePalette,
    pulse: normalized.pulse,
    seaFlow: normalized.seaFlow,
    seaFlowIntensity: normalized.seaFlowIntensity,
  };
}
