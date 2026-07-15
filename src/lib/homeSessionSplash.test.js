/** @jest-environment jsdom */

import {
  HOME_SPLASH_SESSION_KEY,
  hasSeenHomeSplashThisSession,
  markHomeSplashSeenThisSession,
  shouldShowHomeLoadingTransition,
} from "./homeSessionSplash";

describe("homeSessionSplash", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("shows loading transition once per browser session until marked seen", () => {
    expect(shouldShowHomeLoadingTransition()).toBe(true);
    markHomeSplashSeenThisSession();
    expect(hasSeenHomeSplashThisSession()).toBe(true);
    expect(shouldShowHomeLoadingTransition()).toBe(false);
    window.sessionStorage.clear();
    expect(shouldShowHomeLoadingTransition()).toBe(true);
  });

  test("session key is stable", () => {
    markHomeSplashSeenThisSession();
    expect(window.sessionStorage.getItem(HOME_SPLASH_SESSION_KEY)).toBe("1");
  });
});
