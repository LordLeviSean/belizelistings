/** @jest-environment jsdom */

jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

jest.mock("../../lib/crm/useViewingsRealtime", () => ({
  useViewingsRealtime: jest.fn(),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("../../lib/crm/viewingMutations", () => ({
  archiveViewing: jest.fn(),
  cancelViewing: jest.fn(),
  deleteViewing: jest.fn(),
  proposeViewingReschedule: jest.fn(),
  acceptViewingReschedule: jest.fn(),
  rejectViewingReschedule: jest.fn(),
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import BuyerViewingsPanel from "./BuyerViewingsPanel";
import listStyles from "./AgentInquiryList.module.css";

function renderPanel(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BuyerViewingsPanel {...props} />);
  });
  return { container, root };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("BuyerViewingsPanel deep links", () => {
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = "";
    window.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };
    window.cancelAnimationFrame = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("highlights declined viewing from deep link id", async () => {
    renderPanel({
      buyerUserId: "buyer-1",
      initialViewingId: "view-declined-1",
      deepLinkResolveState: "resolved",
      listingsById: { 42: { title: "Finca Solana" } },
      viewings: [
        {
          id: "view-declined-1",
          listing_id: 42,
          status: "declined",
          requested_date: "2026-07-15",
          requested_time: "10:00",
        },
      ],
    });
    await flushEffects();

    const highlighted = document.body.querySelector(`.${listStyles.cardHighlighted}`);
    expect(highlighted).toBeTruthy();
    expect(highlighted.textContent).toMatch(/Declined/i);
    expect(highlighted.textContent).toMatch(/Finca Solana/i);
  });

  test("preserves deep link selection after async viewings load", async () => {
    const { root } = renderPanel({
      buyerUserId: "buyer-1",
      initialViewingId: "view-declined-2",
      deepLinkResolveState: "loading",
      crmLoading: true,
      listingsById: {},
      viewings: [],
    });

    expect(document.body.querySelector('[aria-label="Loading viewing request"]')).toBeTruthy();

    await act(async () => {
      root.render(
        <BuyerViewingsPanel
          buyerUserId="buyer-1"
          initialViewingId="view-declined-2"
          deepLinkResolveState="resolved"
          listingsById={{ 7: { title: "Coastal Lot" } }}
          viewings={[
            {
              id: "view-declined-2",
              listing_id: 7,
              status: "declined",
              requested_date: "2026-07-16",
              requested_time: "14:00",
            },
          ]}
        />
      );
    });
    await flushEffects();

    const highlighted = document.body.querySelector(`.${listStyles.cardHighlighted}`);
    expect(highlighted).toBeTruthy();
    expect(highlighted.textContent).toMatch(/Coastal Lot/i);
  });

  test("confirmed viewing deep links still highlight", async () => {
    renderPanel({
      buyerUserId: "buyer-1",
      initialViewingId: "view-confirmed-1",
      deepLinkResolveState: "resolved",
      listingsById: { 11: { title: "Riverfront Home" } },
      viewings: [
        {
          id: "view-confirmed-1",
          listing_id: 11,
          status: "confirmed",
          requested_date: "2026-07-17",
          requested_time: "09:00",
        },
      ],
    });
    await flushEffects();

    expect(document.body.querySelector(`.${listStyles.cardHighlighted}`)).toBeTruthy();
  });

  test("does not render another card while deep-link target is still resolving", async () => {
    renderPanel({
      buyerUserId: "buyer-1",
      initialViewingId: "view-target-1",
      deepLinkResolveState: "loading",
      crmLoading: false,
      listingsById: {},
      viewings: [{ id: "view-other-1", status: "pending", requested_date: "2026-07-10" }],
    });

    expect(document.body.querySelector('[aria-label="Loading viewing request"]')).toBeTruthy();
    expect(document.body.querySelector(`.${listStyles.cardHighlighted}`)).toBeNull();
  });
});
