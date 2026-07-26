/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ListingLifecycleBadgeStack from "./ListingLifecycleBadgeStack";
import { LISTING_LIFECYCLE } from "../../constants/operationalModel";
import {
  __resetListingArchiveCountdownClockForTests,
} from "../../lib/listings/useListingArchiveCountdownClock";

const dashboardStyles = {
  listingBadgeStack: "listingBadgeStack",
  statusBadge: "statusBadge",
  statusRecentlySold: "statusRecentlySold",
  statusRecentlyRented: "statusRecentlyRented",
  statusApproved: "statusApproved",
  statusArchived: "statusArchived",
};

function renderStack(listing, badgeLabel, badgeClass) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ListingLifecycleBadgeStack
        listing={listing}
        badgeLabel={badgeLabel}
        badgeClass={badgeClass}
        styles={dashboardStyles}
      />
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      __resetListingArchiveCountdownClockForTests();
    },
    text: () => container.textContent,
    queryCountdown: () => container.querySelector("[aria-label*='Archives']"),
  };
}

describe("ListingLifecycleBadgeStack", () => {
  afterEach(() => {
    __resetListingArchiveCountdownClockForTests();
  });

  test("sold listing shows countdown beside Sold badge", () => {
    const view = renderStack(
      {
        id: 1,
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
        sold_at: "2026-07-10T10:00:00.000Z",
        closed_at: "2026-07-10T10:00:00.000Z",
      },
      "Sold",
      "RecentlySold"
    );
    expect(view.text()).toContain("Sold");
    expect(view.text()).toMatch(/Archives in|Archiving shortly/);
    expect(view.queryCountdown()).not.toBeNull();
    view.unmount();
  });

  test("rented listing shows countdown beside Rented badge", () => {
    const view = renderStack(
      {
        id: 2,
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_RENTED,
        rented_at: "2026-07-10T10:00:00.000Z",
        closed_at: "2026-07-10T10:00:00.000Z",
      },
      "Rented",
      "RecentlyRented"
    );
    expect(view.text()).toContain("Rented");
    expect(view.text()).toMatch(/Archives in|Archiving shortly/);
    view.unmount();
  });

  test("published listing hides countdown", () => {
    const view = renderStack(
      {
        id: 3,
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.PUBLISHED,
      },
      "Published",
      "Approved"
    );
    expect(view.text()).toBe("Published");
    expect(view.queryCountdown()).toBeNull();
    view.unmount();
  });

  test("archived listing hides countdown", () => {
    const view = renderStack(
      {
        id: 4,
        status: "archived",
        lifecycle_status: LISTING_LIFECYCLE.ARCHIVED,
        closed_at: "2026-07-01T10:00:00.000Z",
      },
      "Archived",
      "Archived"
    );
    expect(view.text()).toBe("Archived");
    expect(view.queryCountdown()).toBeNull();
    view.unmount();
  });

  test("missing closed timestamp fails gracefully without broken copy", () => {
    const view = renderStack(
      {
        id: 5,
        status: "approved",
        lifecycle_status: LISTING_LIFECYCLE.RECENTLY_SOLD,
      },
      "Sold",
      "RecentlySold"
    );
    expect(view.text()).toBe("Sold");
    expect(view.text()).not.toMatch(/NaN|undefined/);
    expect(view.queryCountdown()).toBeNull();
    view.unmount();
  });
});
