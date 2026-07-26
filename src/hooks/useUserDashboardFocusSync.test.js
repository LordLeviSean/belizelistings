/** @jest-environment jsdom */

import { useUserDashboardFocusSync } from "./useUserDashboardFocusSync";

const mockInvalidate = jest.fn();

jest.mock("../stores/useUserDashboardStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      invalidate: mockInvalidate,
    }),
  },
}));

describe("useUserDashboardFocusSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  test("window focus triggers listings invalidate for owner dashboard", () => {
    const React = require("react");
    const { createRoot } = require("react-dom/client");
    const { act } = require("react");

    function Probe() {
      useUserDashboardFocusSync("owner-1", "user");
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mockInvalidate).toHaveBeenCalledWith({ listings: true });

    act(() => root.unmount());
  });
});
