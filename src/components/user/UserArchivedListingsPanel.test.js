/**
 * Regression: archived tab must render rows without throwing (missing LISTING_LIFECYCLE import crashed render).
 */
jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => `<a href="${href}">${children}</a>`,
}));
jest.mock("zustand/react/shallow", () => ({ useShallow: (fn) => fn }));
jest.mock("../../stores/useUserDashboardStore", () => ({
  __esModule: true,
  default: (selector) =>
    selector({
      myListingsRows: [
        {
          id: 42,
          status: "archived",
          title: "Archived home",
          district: "corozal",
          price: 250000,
          archived_at: "2026-06-01T12:00:00.000Z",
        },
      ],
      listingsLoading: false,
      myListingsInitialFetchDone: true,
      activeListings: 0,
      invalidate: jest.fn(),
      patchMyListingRow: jest.fn(),
      removeMyListingRow: jest.fn(),
    }),
}));
jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

import React from "react";
import { renderToString } from "react-dom/server";
import UserArchivedListingsPanel from "./UserArchivedListingsPanel";

describe("UserArchivedListingsPanel", () => {
  test("renders archived inventory without throwing", () => {
    expect(() =>
      renderToString(<UserArchivedListingsPanel userId="user-1" tier="free" />)
    ).not.toThrow();
  });
});
