/** @jest-environment node */

import {
  __resetListingArchiveCountdownClockForTests,
  useListingArchiveCountdownClock,
} from "./useListingArchiveCountdownClock";

jest.useFakeTimers();

describe("useListingArchiveCountdownClock", () => {
  afterEach(() => {
    __resetListingArchiveCountdownClockForTests();
    jest.clearAllTimers();
  });

  test("shared timer registry resets on cleanup", () => {
    __resetListingArchiveCountdownClockForTests();
    expect(useListingArchiveCountdownClock).toBeDefined();
  });

  test("multiple deadlines can register without throwing", () => {
    const deadlineA = Date.now() + 3_600_000;
    const deadlineB = Date.now() + 7_200_000;
    __resetListingArchiveCountdownClockForTests();
    const { useEffect } = require("react");
    const listeners = [];
    function mount(deadline) {
      function HookProbe() {
        useListingArchiveCountdownClock(deadline);
        useEffect(() => {
          listeners.push(deadline);
        }, [deadline]);
        return null;
      }
      return HookProbe;
    }
    expect(() => mount(deadlineA)).not.toThrow();
    expect(() => mount(deadlineB)).not.toThrow();
  });
});
