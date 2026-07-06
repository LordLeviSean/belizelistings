export const HOMEPAGE_SEA_FLOW_MULTIPLIER_KEY = "blz_homepage_sea_flow_multiplier_v1";
export const HOMEPAGE_SEA_FLOW_MULTIPLIER_EVENT = "blz-homepage-sea-flow-multiplier-change";
/** 25% — very subtle; recommended default for mobile map hero */
export const HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT = 0.25;

export const HOMEPAGE_SEA_FLOW_MULTIPLIER_STOPS = [0, 0.25, 0.5, 1, 1.5, 2, 3];

export const HOMEPAGE_SEA_FLOW_MULTIPLIER_LABELS = {
  0: "Disabled",
  0.25: "Very subtle",
  0.5: "Slight",
  1: "Baseline",
  1.5: "Enhanced",
  2: "Strong",
  3: "Maximum",
};

export function clampHomepageSeaFlowMultiplier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT;
  return Math.min(3, Math.max(0, n));
}

export function getHomepageSeaFlowMultiplierLabel(multiplier) {
  const m = clampHomepageSeaFlowMultiplier(multiplier);
  const pct = Math.round(m * 100);
  const stop = HOMEPAGE_SEA_FLOW_MULTIPLIER_STOPS.find((s) => Math.round(s * 100) === pct);
  if (stop != null && HOMEPAGE_SEA_FLOW_MULTIPLIER_LABELS[stop]) {
    return `${pct}% · ${HOMEPAGE_SEA_FLOW_MULTIPLIER_LABELS[stop]}`;
  }
  return `${pct}%`;
}

export function readHomepageSeaFlowMultiplier() {
  if (typeof window === "undefined") return HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT;
  const raw = window.localStorage.getItem(HOMEPAGE_SEA_FLOW_MULTIPLIER_KEY);
  if (raw == null || raw === "") return HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT;
  return clampHomepageSeaFlowMultiplier(raw);
}

export function writeHomepageSeaFlowMultiplier(multiplier) {
  if (typeof window === "undefined") return;
  const next = clampHomepageSeaFlowMultiplier(multiplier);
  window.localStorage.setItem(HOMEPAGE_SEA_FLOW_MULTIPLIER_KEY, String(next));
  window.dispatchEvent(
    new CustomEvent(HOMEPAGE_SEA_FLOW_MULTIPLIER_EVENT, {
      detail: { multiplier: next },
    })
  );
}

/** Nearest admin slider stop for QA consistency */
export function snapHomepageSeaFlowMultiplier(multiplier) {
  const t = clampHomepageSeaFlowMultiplier(multiplier);
  const pct = Math.round(t * 100);
  let best = HOMEPAGE_SEA_FLOW_MULTIPLIER_STOPS[0];
  let bestDelta = Math.abs(Math.round(best * 100) - pct);
  for (const stop of HOMEPAGE_SEA_FLOW_MULTIPLIER_STOPS) {
    const delta = Math.abs(Math.round(stop * 100) - pct);
    if (delta < bestDelta) {
      best = stop;
      bestDelta = delta;
    }
  }
  return best;
}
