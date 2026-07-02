/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
}));

jest.mock("../../lib/deviceDetection", () => ({
  copyTextToClipboard: jest.fn().mockResolvedValue(true),
  isMobileContactDevice: jest.fn().mockReturnValue(false),
  MOBILE_CONTACT_MQ: "(max-width: 640px)",
}));

jest.mock("../../lib/listingContactResolver", () => ({
  resolveListingContact: jest.fn(() => ({
    displayName: "Jane Agent",
    email: "jane@example.com",
    phone: "+5016001234",
    showEmailPublic: true,
    showPhonePublic: true,
  })),
  resolveListingContactFromListingFields: jest.fn(() => null),
}));

jest.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ContactAgentModal from "./ContactAgentModal";
import styles from "./ContactAgentModal.module.css";

function renderModal(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

describe("ContactAgentModal", () => {
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

  test("renders contact fields when open", () => {
    const { container } = renderModal(
      <ContactAgentModal
        open
        onClose={() => {}}
        listing={{ id: 1, title: "Beach Villa" }}
        onOpenSiteMessage={() => {}}
      />
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/Contact agent/i);
    expect(dialog.textContent).toMatch(/Jane Agent/i);
    expect(dialog.textContent).toMatch(/Phone/i);
    expect(dialog.textContent).toMatch(/Email/i);
    expect(dialog.textContent).toMatch(/Message via BelizeListings/i);
    expect(container.querySelector(`.${styles.copyBtn}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.primaryActionBtn}`)).toBeTruthy();
  });

  test("returns null when closed", () => {
    const { container } = renderModal(
      <ContactAgentModal open={false} onClose={() => {}} listing={{ id: 1 }} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
