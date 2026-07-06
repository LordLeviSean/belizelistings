/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingInteractionModal from "./ListingInteractionModal";
import modalStyles from "./ListingInteractionModal.module.css";

function renderModal(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe("ListingInteractionModal", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
  });

  test("renders dialog with title and children when open", () => {
    const { container } = renderModal(
      <ListingInteractionModal isOpen onClose={() => {}} title="Contact agent">
        <p>Modal body</p>
      </ListingInteractionModal>
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/Contact agent/i);
    expect(dialog.textContent).toMatch(/Modal body/i);
    expect(document.body.querySelector(`.${modalStyles.close}`)).toBeTruthy();
  });

  test("renders optional footer", () => {
    const { container } = renderModal(
      <ListingInteractionModal
        isOpen
        onClose={() => {}}
        title="Schedule a viewing"
        footer={<button type="button">Continue</button>}
      >
        <p>Pick a date</p>
      </ListingInteractionModal>
    );

    expect(document.body.textContent).toMatch(/Continue/i);
    expect(document.body.querySelector(`.${modalStyles.footer}`)).toBeTruthy();
  });

  test("returns null when closed", () => {
    const { container } = renderModal(
      <ListingInteractionModal isOpen={false} onClose={() => {}} title="Hidden">
        <p>Hidden body</p>
      </ListingInteractionModal>
    );
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
