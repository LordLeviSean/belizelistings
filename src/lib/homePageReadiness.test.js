/** @jest-environment node */

import {
  HOME_LOADING_MAX_MS,
  HOME_READINESS_INITIAL,
  advanceLoadingStage,
  evaluateHomePageReadiness,
} from "./homePageReadiness";

describe("homePageReadiness", () => {
  test("requires all readiness signals", () => {
    expect(evaluateHomePageReadiness(HOME_READINESS_INITIAL)).toBe(false);
    expect(
      evaluateHomePageReadiness({
        ...HOME_READINESS_INITIAL,
        shell: true,
        hero: true,
        mapInitialized: true,
        searchReady: true,
        navInteractive: true,
        featuredListingsReady: true,
      })
    ).toBe(true);
  });

  test("advanceLoadingStage progresses without fixed timer semantics", () => {
    expect(advanceLoadingStage(0)).toBe(1);
    expect(advanceLoadingStage(250)).toBe(2);
    expect(advanceLoadingStage(600)).toBe(3);
    expect(advanceLoadingStage(600, true)).toBe(3);
  });

  test("safety cap is two and a half seconds", () => {
    expect(HOME_LOADING_MAX_MS).toBe(2500);
  });
});
