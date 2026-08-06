/** @jest-environment jsdom */

import { shouldShowInstallAppEntry } from "./installAppVisibility";

const baseState = {
  isSupported: true,
  isInstallable: false,
  isStandalone: false,
  isInstalled: false,
  isIos: false,
  isIosManualInstallEligible: false,
  nativePromptAvailable: false,
  nativePromptPending: false,
  installationOutcome: null,
};

describe("shouldShowInstallAppEntry", () => {
  test("shows when native prompt is available", () => {
    expect(
      shouldShowInstallAppEntry({
        ...baseState,
        isInstallable: true,
        nativePromptAvailable: true,
      })
    ).toBe(true);
  });

  test("shows for eligible iOS manual installation", () => {
    expect(
      shouldShowInstallAppEntry({
        ...baseState,
        isInstallable: true,
        isIos: true,
        isIosManualInstallEligible: true,
      })
    ).toBe(true);
  });

  test("hides while native eligibility is pending", () => {
    expect(
      shouldShowInstallAppEntry({
        ...baseState,
        nativePromptPending: true,
      })
    ).toBe(false);
  });

  test("can show iOS guidance while Chromium pending is irrelevant", () => {
    expect(
      shouldShowInstallAppEntry({
        ...baseState,
        isInstallable: true,
        isIosManualInstallEligible: true,
        nativePromptPending: false,
      })
    ).toBe(true);
  });

  test("hides when installed or standalone", () => {
    expect(
      shouldShowInstallAppEntry({ ...baseState, isInstalled: true, isInstallable: true })
    ).toBe(false);
    expect(
      shouldShowInstallAppEntry({ ...baseState, isStandalone: true, isInstallable: true })
    ).toBe(false);
  });

  test("hides on unsupported or ineligible browsers", () => {
    expect(shouldShowInstallAppEntry(baseState)).toBe(false);
  });

  test("waits for client readiness", () => {
    expect(
      shouldShowInstallAppEntry(
        { ...baseState, isInstallable: true, nativePromptAvailable: true },
        { clientReady: false }
      )
    ).toBe(false);
  });
});
