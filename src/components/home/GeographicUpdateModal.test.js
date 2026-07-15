/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import GeographicUpdateModal from "./GeographicUpdateModal";
import { GEOGRAPHIC_UPDATE_MODAL_COPY } from "../../lib/geography/geographicUpdateLaunch";

const mockPush = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../listing/ListingInteractionModal", () => ({
  __esModule: true,
  default: ({ isOpen, children, title }) =>
    isOpen ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

jest.mock("../../lib/geography/geographicUpdateLaunch", () => {
  const actual = jest.requireActual("../../lib/geography/geographicUpdateLaunch");
  return {
    ...actual,
    markGeographicUpdateModalSeen: jest.fn(async () => ({ ok: true })),
  };
});

function renderModal(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <GeographicUpdateModal
        open
        onClose={() => {}}
        user={{ id: "u1" }}
        role="agent"
        supabase={{}}
        {...props}
      />
    );
  });
  return { container, root };
}

describe("GeographicUpdateModal", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
    mockPush.mockClear();
  });

  test("Explore the Update opens archived geographic learn-more entry", async () => {
    renderModal();
    const exploreBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      /Explore the Update/i.test(btn.textContent)
    );
    expect(exploreBtn).toBeTruthy();
    await act(async () => {
      exploreBtn.click();
      await Promise.resolve();
    });
    expect(mockPush).toHaveBeenCalledWith(GEOGRAPHIC_UPDATE_MODAL_COPY.learnMoreHref);
    expect(GEOGRAPHIC_UPDATE_MODAL_COPY.learnMoreHref).toBe("/learn-more#geographic-update-v1");
  });
});
