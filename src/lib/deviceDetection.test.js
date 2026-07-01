/** @jest-environment node */

import { copyTextToClipboard, isMobileContactDevice, MOBILE_CONTACT_MQ } from "./deviceDetection";

describe("deviceDetection", () => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNavigator = global.navigator;

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.navigator = originalNavigator;
  });

  test("isMobileContactDevice is false on wide desktop", () => {
    global.window = {
      matchMedia: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
      innerWidth: 1280,
    };
    expect(isMobileContactDevice()).toBe(false);
    expect(global.window.matchMedia).toHaveBeenCalledWith(MOBILE_CONTACT_MQ);
  });

  test("isMobileContactDevice is true when mobile MQ matches", () => {
    global.window = {
      matchMedia: jest.fn().mockImplementation((query) => ({
        matches: query === MOBILE_CONTACT_MQ,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
      innerWidth: 1280,
    };
    expect(isMobileContactDevice()).toBe(true);
  });

  test("copyTextToClipboard uses navigator.clipboard", async () => {
    global.navigator = { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } };
    global.document = undefined;
    const ok = await copyTextToClipboard("+501 600 1111");
    expect(ok).toBe(true);
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith("+501 600 1111");
  });
});
