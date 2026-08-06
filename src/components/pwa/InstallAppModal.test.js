/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import InstallAppModal, { INSTALL_LEAD_COPY, IOS_STEPS } from "./InstallAppModal";
import { INSTALLATION_OUTCOMES } from "@/lib/pwa/installationState";

const mockRequestInstall = jest.fn();
const mockUseInstallationState = jest.fn();

jest.mock("../../hooks/useInstallationState", () => ({
  useInstallationState: () => mockUseInstallationState(),
}));

function renderModal(props = {}) {
  const utils = {
    onClose: jest.fn(),
    returnFocusRef: { current: null },
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <InstallAppModal
        isOpen
        onClose={utils.onClose}
        returnFocusRef={utils.returnFocusRef}
        {...props}
      />
    );
  });

  return { container, root, ...utils };
}

function baseState(overrides = {}) {
  return {
    nativePromptAvailable: false,
    isIosManualInstallEligible: false,
    isInstalled: false,
    requestInstall: mockRequestInstall,
    ...overrides,
  };
}

describe("InstallAppModal", () => {
  beforeEach(() => {
    mockRequestInstall.mockReset();
    mockUseInstallationState.mockReturnValue(baseState());
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("opening the interface does not automatically call requestInstall", () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    renderModal();
    expect(mockRequestInstall).not.toHaveBeenCalled();
  });

  test("native install button calls requestInstall only after deliberate click", async () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    mockRequestInstall.mockResolvedValue({ ok: true, outcome: INSTALLATION_OUTCOMES.DISMISSED });

    renderModal();
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );
    expect(installButton).toBeTruthy();

    await act(async () => {
      installButton.click();
      await Promise.resolve();
    });

    expect(mockRequestInstall).toHaveBeenCalledTimes(1);
  });

  test("accepted outcome closes without claiming installed in copy", async () => {
    const onClose = jest.fn();
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    mockRequestInstall.mockResolvedValue({ ok: true, outcome: INSTALLATION_OUTCOMES.ACCEPTED });

    renderModal({ onClose });
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );

    await act(async () => {
      installButton.click();
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/successfully installed/i);
  });

  test("dismissed outcome closes without crashing or re-prompting", async () => {
    const onClose = jest.fn();
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    mockRequestInstall.mockResolvedValue({ ok: true, outcome: INSTALLATION_OUTCOMES.DISMISSED });

    renderModal({ onClose });
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );

    await act(async () => {
      installButton.click();
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalled();
    expect(mockRequestInstall).toHaveBeenCalledTimes(1);
  });

  test("unavailable outcome presents safe fallback copy", async () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    mockRequestInstall.mockResolvedValue({
      ok: false,
      outcome: INSTALLATION_OUTCOMES.UNAVAILABLE,
    });

    renderModal();
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );

    await act(async () => {
      installButton.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toMatch(/isn't available from this browser right now/i);
  });

  test("prompt rejection does not throw", async () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    mockRequestInstall.mockRejectedValue(new Error("blocked"));

    renderModal();
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );

    await act(async () => {
      installButton.click();
      await Promise.resolve();
    });

    expect(document.body.textContent).toMatch(/isn't available from this browser right now/i);
  });

  test("repeated clicks are prevented while request is pending", async () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ nativePromptAvailable: true })
    );
    let resolveRequest;
    mockRequestInstall.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderModal();
    const installButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent.includes("Install App")
    );

    act(() => {
      installButton.click();
    });
    act(() => {
      installButton.click();
    });

    expect(mockRequestInstall).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({ ok: true, outcome: INSTALLATION_OUTCOMES.DISMISSED });
      await Promise.resolve();
    });
  });

  test("iOS guidance does not call requestInstall", () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ isIosManualInstallEligible: true })
    );

    renderModal();
    expect(mockRequestInstall).not.toHaveBeenCalled();
    expect(
      Array.from(document.querySelectorAll("button")).some((btn) =>
        btn.textContent.includes("Install App")
      )
    ).toBe(false);
  });

  test("iOS guidance includes Safari, Share, Add to Home Screen and Add", () => {
    mockUseInstallationState.mockReturnValue(
      baseState({ isIosManualInstallEligible: true })
    );

    renderModal();
    const text = document.body.textContent;
    expect(text).toMatch(/Safari/i);
    expect(text).toMatch(/Share/i);
    expect(text).toMatch(/Add to Home Screen/i);
    expect(text).toMatch(/Tap “Add.”/);
    expect(IOS_STEPS.length).toBeGreaterThanOrEqual(4);
  });

  test("installed state closes the modal", () => {
    const onClose = jest.fn();
    mockUseInstallationState.mockReturnValue(
      baseState({ isInstalled: true, nativePromptAvailable: true })
    );

    renderModal({ onClose });
    expect(onClose).toHaveBeenCalled();
  });

  test("close button closes the modal", () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    document.querySelector('[aria-label="Close install dialog"]').click();
    expect(onClose).toHaveBeenCalled();
  });

  test("Escape closes the modal", () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  test("accessible dialog labels are present", () => {
    renderModal();
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy();
    expect(document.getElementById("install-app-title")?.textContent).toBe("Install BelizeListings");
    expect(document.body.textContent).toContain(INSTALL_LEAD_COPY);
  });

  test("focus restores to the entry trigger after closing", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Install App";
    document.body.appendChild(trigger);
    trigger.focus();

    const returnFocusRef = { current: trigger };
    const onClose = jest.fn();
    const { root } = renderModal({ onClose, returnFocusRef });

    act(() => {
      root.render(
        <InstallAppModal isOpen={false} onClose={onClose} returnFocusRef={returnFocusRef} />
      );
    });

    expect(document.activeElement).toBe(trigger);
  });
});

describe("InstallAppModal integration contract", () => {
  test("does not introduce a second beforeinstallprompt listener", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "InstallAppModal.jsx"),
      "utf8"
    );
    expect(source).not.toMatch(/beforeinstallprompt/);
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});
