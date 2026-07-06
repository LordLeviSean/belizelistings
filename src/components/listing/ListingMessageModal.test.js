/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingMessageModal from "./ListingMessageModal";
import modalStyles from "./ListingInteractionModal.module.css";

jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({ user: null, profile: null, role: null }),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../lib/listingInquiries", () => ({
  submitListingInquiry: jest.fn(),
}));

jest.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

function renderModal(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe("ListingMessageModal", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
  });

  test("composes ListingInteractionModal shell when open", () => {
    const { container } = renderModal(
      <ListingMessageModal
        open
        onClose={() => {}}
        listing={{ id: "abc-123", title: "Test listing" }}
      />
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/Message the agent/i);
    expect(dialog.textContent).toMatch(/Your message will be delivered securely/i);
    expect(document.body.querySelector(`.${modalStyles.close}`)).toBeTruthy();
    expect(document.body.querySelector('[type="submit"]')).toBeTruthy();
    expect(document.body.querySelector("#listing-message-form")).toBeTruthy();
  });

  test("returns null when closed", () => {
    const { container } = renderModal(
      <ListingMessageModal
        open={false}
        onClose={() => {}}
        listing={{ id: "abc-123" }}
      />
    );
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
