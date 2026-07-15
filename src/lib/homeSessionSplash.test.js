/** @jest-environment jsdom */

import {
  HOME_SPLASH_HOLD_MS,
  HOME_SPLASH_SESSION_KEY,
  hasSeenHomeSplashThisSession,
  markHomeSplashSeenThisSession,
  prefersReducedMotionSplash,
  shouldShowHomeSessionSplash,
} from "./homeSessionSplash";

describe("homeSessionSplash", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("hold duration is three seconds", () => {
    expect(HOME_SPLASH_HOLD_MS).toBe(3000);
  });

  test("shows once per browser session until marked seen", () => {
    expect(shouldShowHomeSessionSplash()).toBe(true);
    markHomeSplashSeenThisSession();
    expect(hasSeenHomeSplashThisSession()).toBe(true);
    expect(shouldShowHomeSessionSplash()).toBe(false);
    window.sessionStorage.clear();
    expect(shouldShowHomeSessionSplash()).toBe(true);
  });

  test("skips splash when prefers-reduced-motion is set", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    expect(prefersReducedMotionSplash()).toBe(true);
    expect(shouldShowHomeSessionSplash()).toBe(false);
  });

  test("session key is stable", () => {
    markHomeSplashSeenThisSession();
    expect(window.sessionStorage.getItem(HOME_SPLASH_SESSION_KEY)).toBe("1");
  });
});
