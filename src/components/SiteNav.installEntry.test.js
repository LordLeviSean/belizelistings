/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import SiteNav from "./SiteNav";
import { InstallationStateProvider } from "@/lib/pwa/InstallationStateProvider";
import { __resetInstallationStateForTests, initInstallationState } from "@/lib/pwa/installationState";
import { getInstallationBootstrapScript } from "@/lib/pwa/installationBootstrap";

jest.mock("./BrandWordmark", () => ({
  __esModule: true,
  default: () => <div data-testid="brand-wordmark" />,
}));

jest.mock("../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({
    user: null,
    role: "user",
    loading: false,
  }),
}));

jest.mock("./auth/AuthGateProvider", () => ({
  useAuthGate: () => ({
    openLoginIfNeeded: jest.fn(),
    logoutToHome: jest.fn(),
  }),
}));

jest.mock("./notifications/NotificationCenter", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
    push: jest.fn(),
    query: {},
  }),
}));

function renderSiteNav() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <InstallationStateProvider>
        <SiteNav active="browse" />
      </InstallationStateProvider>
    );
  });
  return { container, root };
}

describe("SiteNav install entry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetInstallationStateForTests();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    // eslint-disable-next-line no-eval
    eval(getInstallationBootstrapScript());
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = "";
    __resetInstallationStateForTests();
  });

  test("shows install entry when native prompt is available", async () => {
    const deferred = {
      preventDefault: jest.fn(),
      platforms: ["web"],
      prompt: jest.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    };
    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    const { container } = renderSiteNav();
    initInstallationState();

    await act(async () => {
      await Promise.resolve();
    });

    const buttons = Array.from(container.querySelectorAll("button")).filter((btn) =>
      btn.textContent.includes("Install App")
    );
    expect(buttons.length).toBeGreaterThan(0);
  });

  test("uses shared install interface from navigation entry", async () => {
    const deferred = {
      preventDefault: jest.fn(),
      platforms: ["web"],
      prompt: jest.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    };
    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    const { container } = renderSiteNav();
    initInstallationState();

    await act(async () => {
      await Promise.resolve();
    });

    const entry = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );
    expect(entry).toBeTruthy();

    act(() => {
      entry.click();
    });

    expect(document.querySelector('[aria-labelledby="install-app-title"]')).toBeTruthy();
  });
});
