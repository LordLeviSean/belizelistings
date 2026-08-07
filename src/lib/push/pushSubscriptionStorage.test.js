/** @jest-environment jsdom */

import {
  clearStoredPushDevice,
  pushDeviceStorageKey,
  readStoredPushDevice,
  writeStoredPushDevice,
} from "./pushSubscriptionStorage";

describe("pushSubscriptionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("stores and reads subscription id per user", () => {
    writeStoredPushDevice("user-1", "sub-abc");
    expect(readStoredPushDevice("user-1")).toEqual({ subscriptionId: "sub-abc" });
    expect(readStoredPushDevice("user-2")).toEqual({ subscriptionId: null });
  });

  test("clearStoredPushDevice removes entry", () => {
    writeStoredPushDevice("user-1", "sub-abc");
    clearStoredPushDevice("user-1");
    expect(window.localStorage.getItem(pushDeviceStorageKey("user-1"))).toBeNull();
  });
});
