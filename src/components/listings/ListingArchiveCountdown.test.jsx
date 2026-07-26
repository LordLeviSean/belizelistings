/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingArchiveCountdown from "./ListingArchiveCountdown";
import { LISTING_LIFECYCLE } from "../../constants/operationalModel";
import {
  __resetListingArchiveCountdownClockForTests,
} from "../../lib/listings/useListingArchiveCountdownClock";

function renderCountdown(listing) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ListingArchiveCountdown listing={listing} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      __resetListingArchiveCountdownClockForTests();
    },
    text: () => container.textContent,
  };
}

describe("ListingArchiveCountdown", () => {
  afterEach(() => {
    __resetListingArchiveCountdownClockForTests();
  });

  test("renders countdown for recently sold listing", () => {
    const view = renderCountdown({
      id: 1,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      closed_at: "2026-07-10T10:00:00.000Z",
    });
    expect(view.text()).toMatch(/Archives in/);
    view.unmount();
  });

  test("does not render for published listing", () => {
    const view = renderCountdown({
      id: 2,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      closed_at: "2026-07-10T10:00:00.000Z",
    });
    expect(view.text()).toBe("");
    view.unmount();
  });

  test("does not render for archived listing", () => {
    const view = renderCountdown({
      id: 3,
      status: "archived",
      lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
      closed_at: "2026-07-10T10:00:00.000Z",
    });
    expect(view.text()).toBe("");
    view.unmount();
  });

  test("exposes accessible aria-label", () => {
    const view = renderCountdown({
      id: 4,
      status: "approved",
      lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
      closed_at: "2026-07-10T10:00:00.000Z",
    });
    const el = view.container.querySelector("[aria-label]");
    expect(el?.getAttribute("aria-label")).toMatch(/Archives automatically/i);
    view.unmount();
  });
});
