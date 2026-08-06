/** @jest-environment jsdom */

import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import { getInstallationBootstrapScript } from "./installationBootstrap";
import {
  InstallationStateProvider,
  useInstallationState,
} from "./InstallationStateProvider";
import { __resetInstallationStateForTests } from "./installationState";
import { registerBelizeListingsServiceWorker } from "./registerServiceWorker";

jest.mock("./registerServiceWorker", () => ({
  registerBelizeListingsServiceWorker: jest.fn(() => ({
    registered: false,
    reason: "unsupported",
  })),
}));

function runBootstrap() {
  // eslint-disable-next-line no-eval
  eval(getInstallationBootstrapScript());
}

function renderInstallationProbe() {
  const result = { current: null };
  function Probe() {
    const state = useInstallationState();
    useEffect(() => {
      result.current = state;
    }, [state]);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <InstallationStateProvider>
        <Probe />
      </InstallationStateProvider>
    );
  });

  return { result, root, container };
}

describe("InstallationStateProvider", () => {
  beforeEach(() => {
    __resetInstallationStateForTests();
    delete window.__blPwaInstallBridge;
    registerBelizeListingsServiceWorker.mockClear();

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    __resetInstallationStateForTests();
  });

  test("provider exposes captured native prompt after hydration", async () => {
    runBootstrap();
    const deferred = {
      preventDefault: jest.fn(),
      platforms: ["web"],
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    };
    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    const { result } = renderInstallationProbe();

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.nativePromptAvailable).toBe(true);
    expect(typeof result.current.requestInstall).toBe("function");
  });

  test("multiple bootstrap executions do not duplicate listeners", () => {
    runBootstrap();
    const firstBridge = window.__blPwaInstallBridge;
    runBootstrap();
    expect(window.__blPwaInstallBridge).toBe(firstBridge);
  });

  test("requestInstall is not invoked automatically", async () => {
    runBootstrap();
    const deferred = {
      preventDefault: jest.fn(),
      platforms: ["web"],
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    };
    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt"), deferred));

    renderInstallationProbe();

    await act(async () => {
      await Promise.resolve();
    });

    expect(deferred.prompt).not.toHaveBeenCalled();
  });

  test("useInstallationState throws outside provider", () => {
    function Orphan() {
      useInstallationState();
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    expect(() => {
      act(() => {
        root.render(<Orphan />);
      });
    }).toThrow(/InstallationStateProvider/);
  });
});

describe("_app service worker registration contract", () => {
  test("registerBelizeListingsServiceWorker remains importable for _app", () => {
    expect(typeof registerBelizeListingsServiceWorker).toBe("function");
  });
});
