/** Progressive homepage readiness — dismiss loading transition when all signals are true. */

export const HOME_LOADING_MAX_MS = 2500;
export const GEO_UPDATE_MODAL_DELAY_MS = 1500;

export const BELIZE_MAP_SVG_URL = "/maps/clean-mainland-districts.svg";

export const HOME_READINESS_INITIAL = Object.freeze({
  shell: false,
  hero: false,
  mapInitialized: false,
  searchReady: false,
  navInteractive: false,
  featuredListingsReady: false,
});

/** @param {Partial<typeof HOME_READINESS_INITIAL>} signals */
export function evaluateHomePageReadiness(signals = {}) {
  return Boolean(
    signals.shell &&
      signals.hero &&
      signals.mapInitialized &&
      signals.searchReady &&
      signals.navInteractive &&
      signals.featuredListingsReady
  );
}

/** Museum-quality stage progression while loading (not a fixed hold). */
export function advanceLoadingStage(elapsedMs, reducedMotion = false) {
  if (reducedMotion) return 3;
  if (elapsedMs < 200) return 1;
  if (elapsedMs < 500) return 2;
  return 3;
}
