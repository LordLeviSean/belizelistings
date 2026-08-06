/** @jest-environment jsdom */

import {
  getInstallationBootstrapScript,
  PWA_INSTALL_BRIDGE_KEY,
  PWA_INSTALL_BRIDGE_UPDATE_EVENT,
} from "./installationBootstrap";

describe("installationBootstrap", () => {
  beforeEach(() => {
    delete window[PWA_INSTALL_BRIDGE_KEY];
  });

  function runBootstrap() {
    // eslint-disable-next-line no-eval
    eval(getInstallationBootstrapScript());
  }

  test("bootstrap script attaches bridge and beforeinstallprompt listener", () => {
    runBootstrap();
    expect(window[PWA_INSTALL_BRIDGE_KEY]?.bootstrapped).toBe(true);
  });

  test("beforeinstallprompt preventDefault is called and event is retained", () => {
    runBootstrap();

    const preventDefault = jest.fn();
    const deferred = {
      preventDefault,
      platforms: ["web"],
      prompt: jest.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    };

    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    expect(preventDefault).toHaveBeenCalled();
    expect(window[PWA_INSTALL_BRIDGE_KEY].deferredPrompt).toBeTruthy();
    expect(window[PWA_INSTALL_BRIDGE_KEY].deferredPrompt.platforms).toEqual(["web"]);
    expect(window[PWA_INSTALL_BRIDGE_KEY].beforeInstallPromptSeen).toBe(true);
  });

  test("bootstrap does not attach duplicate listeners", () => {
    runBootstrap();
    const firstBridge = window[PWA_INSTALL_BRIDGE_KEY];
    runBootstrap();
    expect(window[PWA_INSTALL_BRIDGE_KEY]).toBe(firstBridge);
  });

  test("appinstalled clears deferred prompt on bridge", () => {
    runBootstrap();
    const deferred = { preventDefault: jest.fn() };
    window[PWA_INSTALL_BRIDGE_KEY].deferredPrompt = deferred;

    window.dispatchEvent(new Event("appinstalled"));

    expect(window[PWA_INSTALL_BRIDGE_KEY].appInstalled).toBe(true);
    expect(window[PWA_INSTALL_BRIDGE_KEY].deferredPrompt).toBeNull();
  });

  test("bridge update event fires after beforeinstallprompt", () => {
    runBootstrap();
    const handler = jest.fn();
    window.addEventListener(PWA_INSTALL_BRIDGE_UPDATE_EVENT, handler);

    const deferred = {
      preventDefault: jest.fn(),
      platforms: ["web"],
    };
    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    expect(handler).toHaveBeenCalled();
  });

  test("bootstrap script is safe to embed in _document", () => {
    const script = getInstallationBootstrapScript();
    expect(script).toContain(PWA_INSTALL_BRIDGE_KEY);
    expect(script).toContain("beforeinstallprompt");
    expect(script).toContain("preventDefault");
    expect(script).toContain("appinstalled");
    expect(script).not.toContain("localStorage");
    expect(script).not.toContain("sessionStorage");
  });
});
