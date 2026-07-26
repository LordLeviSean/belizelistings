/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import BackButton from "./BackButton";

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    asPath: "/search?q=ambergris",
  }),
}));

function renderBackButton(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BackButton {...props} />);
  });
  return {
    container,
    button: () => container.querySelector("button"),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("BackButton", () => {
  const originalHistory = window.history;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, "history", {
      configurable: true,
      value: { ...originalHistory, length: 2 },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "history", {
      configurable: true,
      value: originalHistory,
    });
  });

  test("renders back label with arrow and accessible name", () => {
    const view = renderBackButton();
    const button = view.button();
    expect(button?.textContent).toBe("← Back");
    expect(button?.getAttribute("aria-label")).toBe("Go back");
    view.unmount();
  });

  test("uses browser history when available", () => {
    const view = renderBackButton();
    act(() => {
      view.button()?.click();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    view.unmount();
  });

  test("falls back to homepage on direct load without history", () => {
    Object.defineProperty(window, "history", {
      configurable: true,
      value: { ...originalHistory, length: 1 },
    });
    const view = renderBackButton();
    act(() => {
      view.button()?.click();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
    view.unmount();
  });
});
