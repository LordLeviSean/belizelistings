/** @jest-environment jsdom */

const createViewingRequest = jest.fn();

jest.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({
    user: { id: "buyer-1", email: "buyer@test.com" },
    profile: { email: "buyer@test.com", full_name: "Buyer" },
  }),
}));

jest.mock("../../lib/crm/viewingMutations", () => ({
  createViewingRequest: (...args) => createViewingRequest(...args),
}));

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_TURNSTILE: false,
  BL_ENABLE_VIEWING_PERSIST: true,
  TURNSTILE_SITE_KEY: "",
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingViewingBookingModal from "./ListingViewingBookingModal";

function renderModal() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ListingViewingBookingModal
        open
        onClose={jest.fn()}
        listing={{ id: 42, title: "Finca Solana", user_id: "owner-1" }}
        user={{ id: "buyer-1", email: "buyer@test.com" }}
        agentUserId="owner-1"
      />
    );
  });
  return { container, root };
}

describe("ListingViewingBookingModal unstable profile refs", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
    createViewingRequest.mockResolvedValue({ data: { id: "viewing-1" }, error: null });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("does not crash when useUserRole returns new profile objects each render", () => {
    renderModal();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
    expect(String(console.error.mock.calls.join(" "))).not.toMatch(/Maximum update depth exceeded/i);
  });

  test("confirm still routes through createViewingRequest", async () => {
    renderModal();

    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      /^Continue$/i.test(btn.textContent?.trim() || "")
    );
    expect(continueBtn).toBeTruthy();

    await act(async () => {
      continueBtn.click();
    });

    const confirmBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      /^Confirm viewing$/i.test(btn.textContent?.trim() || "")
    );
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createViewingRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        listingId: 42,
        agentUserId: "owner-1",
        requesterId: "buyer-1",
      })
    );
  });
});
