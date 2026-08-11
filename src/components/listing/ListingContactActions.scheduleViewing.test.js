/** @jest-environment jsdom */

const stableUser = { id: "buyer-1", email: "buyer@test.com" };
const stableProfile = { email: "buyer@test.com", full_name: "Buyer Test" };

jest.mock("next/dynamic", () => {
  const React = require("react");
  return () => {
    const ListingViewingBookingModal = require("./ListingViewingBookingModal").default;
    return ListingViewingBookingModal;
  };
});

jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/listing/42" }),
}));

jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

jest.mock("../../lib/listingContactResolver", () => ({
  fetchListingOwnerContact: jest.fn().mockResolvedValue({ contact: { userId: "owner-1" } }),
}));

jest.mock("../../lib/listingInquiryTargets", () => ({
  resolveListingAgentUserId: jest.fn(() => "owner-1"),
  resolveListingAgentUserIdAsync: jest.fn().mockResolvedValue("owner-1"),
}));

jest.mock("../auth/ListingEngagementAuthPromptProvider", () => ({
  useListingEngagementAuthPrompt: () => jest.fn(),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../utils/canonicalListing", () => ({
  isListingEngagementEnabled: () => true,
  getListingAvailabilityMessage: () => "",
}));

jest.mock("../../lib/authEngagementReturn", () => ({
  LISTING_ENGAGEMENT_ACTIONS: { MESSAGE: "message", VIEWING: "viewing" },
  readPendingListingEngagement: () => null,
  clearPendingListingEngagement: jest.fn(),
}));

jest.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

jest.mock("../../hooks/useUserRole", () => ({
  __esModule: true,
  default: () => ({
    user: stableUser,
    profile: stableProfile,
  }),
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingContactActions from "./ListingContactActions";

function renderActions(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ListingContactActions {...props} />);
  });
  return { container, root };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ListingContactActions schedule viewing", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("clicking Schedule viewing opens the booking modal for signed-in buyers", async () => {
    renderActions({
      listing: { id: 42, user_id: "owner-1", title: "Finca Solana" },
      user: stableUser,
    });
    await flushEffects();

    const scheduleBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      /Schedule viewing/i.test(btn.textContent || "")
    );
    expect(scheduleBtn).toBeTruthy();

    await act(async () => {
      scheduleBtn.click();
      await Promise.resolve();
    });
    await flushEffects();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/Schedule a viewing/i);
    expect(dialog.textContent).toMatch(/Choose a date/i);
    expect(dialog.textContent).toMatch(/Finca Solana|Continue/i);
  });

  test("closing and reopening the booking modal still works", async () => {
    renderActions({
      listing: { id: 42, user_id: "owner-1", title: "Finca Solana" },
      user: stableUser,
    });
    await flushEffects();

    const scheduleBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      /Schedule viewing/i.test(btn.textContent || "")
    );

    await act(async () => {
      scheduleBtn.click();
    });
    await flushEffects();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();

    const closeBtn = document.body.querySelector('[aria-label="Close"]');
    expect(closeBtn).toBeTruthy();
    await act(async () => {
      closeBtn.click();
    });
    await flushEffects();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      scheduleBtn.click();
    });
    await flushEffects();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
