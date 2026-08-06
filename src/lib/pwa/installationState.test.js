/** @jest-environment jsdom */

import {
  getInstallationBootstrapScript,
  PWA_INSTALL_BRIDGE_KEY,
  PWA_INSTALL_BRIDGE_UPDATE_EVENT,
} from "./installationBootstrap";
import {
  __resetInstallationStateForTests,
  detectIosDevice,
  detectStandaloneDisplayMode,
  getInstallationSnapshot,
  initInstallationState,
  INSTALLATION_OUTCOMES,
  requestInstall,
  subscribeInstallationState,
} from "./installationState";

function runBootstrap() {
  // eslint-disable-next-line no-eval
  eval(getInstallationBootstrapScript());
}

function createDeferredPrompt(outcome = "dismissed") {
  const event = {
    platforms: ["web"],
    preventDefault: jest.fn(),
    prompt: jest.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  };
  return event;
}

function dispatchBeforeInstallPrompt(event) {
  window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), event));
}

describe("installationState", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetInstallationStateForTests();
    delete window[PWA_INSTALL_BRIDGE_KEY];

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });

    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetInstallationStateForTests();
  });

  test("early capture occurs before initInstallationState", () => {
    runBootstrap();
    const deferred = createDeferredPrompt();
    dispatchBeforeInstallPrompt(deferred);

    expect(window[PWA_INSTALL_BRIDGE_KEY].deferredPrompt).toBeTruthy();

    initInstallationState();
    const snapshot = getInstallationSnapshot();

    expect(snapshot.nativePromptAvailable).toBe(true);
    expect(snapshot.isInstallable).toBe(true);
  });

  test("captured event is available after hydration via snapshot", () => {
    runBootstrap();
    dispatchBeforeInstallPrompt(createDeferredPrompt());
    initInstallationState();

    expect(getInstallationSnapshot().nativePromptAvailable).toBe(true);
  });

  test("requestInstall prompts only when explicitly invoked", async () => {
    runBootstrap();
    const deferred = createDeferredPrompt("accepted");
    dispatchBeforeInstallPrompt(deferred);
    initInstallationState();

    const result = await requestInstall();

    expect(deferred.prompt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, outcome: INSTALLATION_OUTCOMES.ACCEPTED });
    expect(getInstallationSnapshot().installationOutcome).toBe(INSTALLATION_OUTCOMES.ACCEPTED);
  });

  test("dismissed native choice is recorded", async () => {
    runBootstrap();
    const deferred = createDeferredPrompt("dismissed");
    dispatchBeforeInstallPrompt(deferred);
    initInstallationState();

    const result = await requestInstall();

    expect(result).toEqual({ ok: true, outcome: INSTALLATION_OUTCOMES.DISMISSED });
    expect(getInstallationSnapshot().installationOutcome).toBe(INSTALLATION_OUTCOMES.DISMISSED);
  });

  test("deferred event cannot be prompted twice", async () => {
    runBootstrap();
    const deferred = createDeferredPrompt("dismissed");
    dispatchBeforeInstallPrompt(deferred);
    initInstallationState();

    await requestInstall();
    const second = await requestInstall();

    expect(deferred.prompt).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ ok: false, outcome: INSTALLATION_OUTCOMES.UNAVAILABLE });
  });

  test("missing native event returns unavailable safely", async () => {
    runBootstrap();
    initInstallationState();

    await expect(requestInstall()).resolves.toEqual({
      ok: false,
      outcome: INSTALLATION_OUTCOMES.UNAVAILABLE,
    });
  });

  test("prompt rejection does not throw", async () => {
    runBootstrap();
    const deferred = createDeferredPrompt();
    deferred.prompt.mockRejectedValue(new Error("blocked"));
    dispatchBeforeInstallPrompt(deferred);
    initInstallationState();

    await expect(requestInstall()).resolves.toEqual({
      ok: false,
      outcome: INSTALLATION_OUTCOMES.UNAVAILABLE,
    });
  });

  test("appinstalled clears deferred prompt and marks installed", () => {
    runBootstrap();
    dispatchBeforeInstallPrompt(createDeferredPrompt());
    initInstallationState();

    window.dispatchEvent(new Event("appinstalled"));

    const snapshot = getInstallationSnapshot();
    expect(snapshot.nativePromptAvailable).toBe(false);
    expect(snapshot.isInstalled).toBe(true);
    expect(snapshot.installationOutcome).toBe(INSTALLATION_OUTCOMES.INSTALLED);
  });

  test("initial standalone display-mode detection works", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    initInstallationState();
    const snapshot = getInstallationSnapshot();

    expect(snapshot.isStandalone).toBe(true);
    expect(snapshot.isInstalled).toBe(true);
    expect(snapshot.isInstallable).toBe(false);
  });

  test("display-mode changes update standalone state", () => {
    let matches = false;
    const listeners = new Map();
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      get matches() {
        return query === "(display-mode: standalone)" ? matches : false;
      },
      media: query,
      addEventListener: jest.fn((event, handler) => listeners.set(event, handler)),
      removeEventListener: jest.fn((event) => listeners.delete(event)),
    }));

    initInstallationState();
    const seen = [];
    subscribeInstallationState((snapshot) => seen.push(snapshot.isStandalone));

    matches = true;
    listeners.get("change")?.();

    expect(seen.at(-1)).toBe(true);
  });

  test("navigator.standalone is recognized on iOS", () => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    initInstallationState();
    const snapshot = getInstallationSnapshot();

    expect(snapshot.isStandalone).toBe(true);
    expect(snapshot.isInstalled).toBe(true);
    expect(detectIosDevice()).toBe(true);
  });

  test("running standalone suppresses installability state", () => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });

    initInstallationState();
    expect(getInstallationSnapshot().isInstallable).toBe(false);
    expect(getInstallationSnapshot().nativePromptAvailable).toBe(false);
  });

  test("iPhone manual-install eligibility is detected conservatively", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: false,
    });

    initInstallationState();
    const snapshot = getInstallationSnapshot();

    expect(snapshot.isIos).toBe(true);
    expect(snapshot.isIosManualInstallEligible).toBe(true);
    expect(snapshot.isInstallable).toBe(true);
  });

  test("iPadOS desktop-style UA with touch is iOS eligible", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });

    expect(detectIosDevice()).toBe(true);
  });

  test("Android Chromium is not marked iOS-manual eligible", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 14) Chrome/150.0.0.0 Mobile",
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "Linux armv8l",
    });

    initInstallationState();
    const snapshot = getInstallationSnapshot();

    expect(snapshot.isIos).toBe(false);
    expect(snapshot.isIosManualInstallEligible).toBe(false);
  });

  test("absence of beforeinstallprompt is not interpreted as installed", () => {
    runBootstrap();
    initInstallationState();
    jest.advanceTimersByTime(2500);

    const snapshot = getInstallationSnapshot();
    expect(snapshot.isInstalled).toBe(false);
    expect(snapshot.installationOutcome).toBeNull();
    expect(snapshot.nativePromptAvailable).toBe(false);
  });

  test("nativePromptPending resolves after eligibility settle window", () => {
    runBootstrap();
    initInstallationState();

    expect(getInstallationSnapshot().nativePromptPending).toBe(true);
    jest.advanceTimersByTime(2500);
    expect(getInstallationSnapshot().nativePromptPending).toBe(false);
  });

  test("SSR snapshot avoids unsafe browser globals", () => {
    const snapshot = getInstallationSnapshot({
      window: null,
      navigator: null,
      location: null,
    });

    expect(snapshot).toEqual({
      isSupported: false,
      isInstallable: false,
      isStandalone: false,
      isInstalled: false,
      isIos: false,
      isIosManualInstallEligible: false,
      nativePromptAvailable: false,
      nativePromptPending: false,
      installationOutcome: null,
    });
  });

  test("initInstallationState is idempotent across repeated calls", () => {
    runBootstrap();
    initInstallationState();
    initInstallationState();

    dispatchBeforeInstallPrompt(createDeferredPrompt());
    expect(getInstallationSnapshot().nativePromptAvailable).toBe(true);
  });

  test("bridge update event syncs deferred prompt after init", () => {
    runBootstrap();
    initInstallationState();

    dispatchBeforeInstallPrompt(createDeferredPrompt());
    window.dispatchEvent(new Event(PWA_INSTALL_BRIDGE_UPDATE_EVENT));

    expect(getInstallationSnapshot().nativePromptAvailable).toBe(true);
  });

  test("detectStandaloneDisplayMode uses capability checks", () => {
    expect(
      detectStandaloneDisplayMode({
        navigator: { standalone: true },
        window: { matchMedia: () => ({ matches: false }) },
      })
    ).toBe(true);
  });
});
