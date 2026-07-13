/**
 * Regression: My Listings must render without throwing (missing Dashboard.module.css import crashed tab).
 */
jest.mock("../../lib/supabaseClient", () => ({ supabase: {} }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => `<a href="${href}">${children}</a>`,
}));
jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), query: {} }),
}));
jest.mock("zustand/react/shallow", () => ({ useShallow: (fn) => fn }));
jest.mock("../../hooks/useModalController", () => ({
  MODAL_TYPES: { DELETE: "delete", ARCHIVE: "archive", MARK_RECENTLY_CLOSED: "closed" },
  useModalController: () => ({
    isModalOpen: () => false,
    activeModal: null,
    openModal: jest.fn(),
    closeModal: jest.fn(),
  }),
}));
jest.mock("../../stores/useUserDashboardStore", () => ({
  __esModule: true,
  default: (selector) =>
    selector({
      listings: [
        {
          id: 101,
          title: "Seafront cottage",
          status: "published",
          lifecycle_status: "published",
          district: "placencia",
          price: 420000,
          listing_images: [],
        },
      ],
      loading: false,
      invalidate: jest.fn(),
      patchMyListingRow: jest.fn(),
      removeMyListingRow: jest.fn(),
      myListingsInitialFetchDone: true,
    }),
}));
jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));
jest.mock("../DeleteConfirmationModal", () => () => null);
jest.mock("../listing/ArchiveListingModal", () => () => null);
jest.mock("../listing/MarkRecentlyClosedModal", () => () => null);
jest.mock("../listing/ListingMediaImage", () => () => null);
jest.mock("../ui/PremiumEmptyState", () => () => null);
jest.mock("./UserListingRowIntel", () => () => null);

import React from "react";
import { renderToString } from "react-dom/server";
import UserMyListingsPanel from "./UserMyListingsPanel";

describe("UserMyListingsPanel", () => {
  test("renders listings inventory without throwing", () => {
    expect(() =>
      renderToString(<UserMyListingsPanel userId="user-1" tier="free" />)
    ).not.toThrow();
  });
});
