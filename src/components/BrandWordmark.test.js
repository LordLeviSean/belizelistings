/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import BrandWordmark from "./BrandWordmark";
import { VisualModeProvider } from "./VisualModeProvider";

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

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

global.fetch = jest.fn();

function renderWordmark(initialConfig = null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <VisualModeProvider initialConfig={initialConfig}>
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
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        livePalette: false,
        pulse: false,
        seaFlow: false,
        seaFlowIntensity: 0.5,
        source: "server",
      }),
    });
  });

  test("renders static wordmark when both modes are disabled", async () => {
    const view = renderWordmark({
      livePalette: false,
      pulse: false,
      seaFlow: false,
      seaFlowIntensity: 0.5,
    });
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("false");
    view.unmount();
  });

  test("applies live palette and pulse data attributes from server config", async () => {
    const view = renderWordmark({
      livePalette: true,
      pulse: true,
      seaFlow: false,
      seaFlowIntensity: 0.5,
    });
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("true");
    expect(wordmark?.getAttribute("data-pulse")).toBe("true");
    view.unmount();
  });

  test("server fetch overrides stale localStorage cache", async () => {
    window.localStorage.setItem("blz_live_palette_mode_v1", "1");
    window.localStorage.setItem("blz_pulse_mode_v1", "1");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        livePalette: false,
        pulse: false,
        seaFlow: false,
        seaFlowIntensity: 0.5,
        source: "server",
      }),
    });

    const view = renderWordmark();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("false");
    view.unmount();
  });

  test("pulse-only does not enable live palette attribute", async () => {
    const view = renderWordmark({
      livePalette: false,
      pulse: true,
      seaFlow: false,
      seaFlowIntensity: 0.5,
    });
    await act(async () => {
      await Promise.resolve();
    });
    const wordmark = view.wordmark();
    expect(wordmark?.getAttribute("data-live")).toBe("false");
    expect(wordmark?.getAttribute("data-pulse")).toBe("true");
    view.unmount();
  });
});
