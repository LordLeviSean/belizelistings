/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import BrandWordmark from "./BrandWordmark";

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

jest.mock("./VisualModeProvider", () => ({
  useVisualMode: () => ({
    livePalette: false,
    pulse: false,
  }),
}));

function renderWordmark() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BrandWordmark />);
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
  });

  test("renders wordmark with visual-mode data attributes from provider", () => {
    const view = renderWordmark();
    const wordmark = view.wordmark();
    expect(wordmark).toBeTruthy();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("false");
    expect(wordmark?.textContent).toContain("BelizeListings");
    view.unmount();
  });
});
