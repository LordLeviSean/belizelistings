/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import BrandWordmark from "./BrandWordmark";
import { VisualModeProvider } from "./VisualModeProvider";
import { writeLivePaletteMode } from "../utils/livePaletteMode";
import { writePulseMode } from "../utils/pulseMode";

jest.mock("next/link", () => {
  return function MockLink({ href, className, children }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

jest.mock("next/font/google", () => ({
  DM_Sans: () => ({ className: "mock-dm-sans" }),
}));

function renderWordmark() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <VisualModeProvider>
        <BrandWordmark />
      </VisualModeProvider>
    );
  });
  return {
    container,
    wordmark: () => container.querySelector('[aria-label="BelizeListings"]'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("BrandWordmark", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  test("renders static wordmark when both modes are disabled", async () => {
    const view = renderWordmark();
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("false");
    view.unmount();
  });

  test("applies live palette and pulse data attributes from global config", async () => {
    writeLivePaletteMode(true);
    writePulseMode(true);
    const view = renderWordmark();
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("true");
    expect(wordmark?.getAttribute("data-pulse")).toBe("true");
    view.unmount();
  });

  test("pulse-only does not enable live palette attribute", async () => {
    writePulseMode(true);
    const view = renderWordmark();
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("true");
    view.unmount();
  });
});
