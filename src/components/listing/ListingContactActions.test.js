/** @jest-environment jsdom */

jest.mock("next/dynamic", () => () => () => null);

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

describe("ListingContactActions", () => {
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

  test("owner sees manage action instead of contact controls", async () => {
    renderActions({
      listing: { id: 42, user_id: "owner-1", title: "Alta Mira Corner Lot" },
      user: { id: "owner-1", email: "owner@test.com" },
    });
    await flushEffects();

    const section = document.body.querySelector('[aria-label="Contact and scheduling"]');
    expect(section).toBeTruthy();
    expect(section.textContent).toMatch(/Manage Your Listing/i);
    expect(section.textContent).toMatch(/This is your listing/i);
    expect(section.querySelector('a[href*="/dashboard"]')).toBeTruthy();
    expect(section.textContent).not.toMatch(/Contact agent/i);
    expect(section.textContent).not.toMatch(/Schedule viewing/i);
  });

  test("buyer still sees contact controls", async () => {
    renderActions({
      listing: { id: 42, user_id: "owner-1", title: "Alta Mira Corner Lot" },
      user: { id: "buyer-1", email: "buyer@test.com" },
    });
    await flushEffects();

    const section = document.body.querySelector('[aria-label="Contact and scheduling"]');
    expect(section).toBeTruthy();
    expect(section.textContent).toMatch(/Contact agent/i);
    expect(section.textContent).toMatch(/Schedule viewing/i);
    expect(section.textContent).not.toMatch(/Manage Your Listing/i);
  });
});
