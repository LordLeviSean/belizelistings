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
  hasPublicDirectContactMethods: jest.fn((contact) =>
    Boolean(contact?.phone || (contact?.showEmailPublic && contact?.email))
  ),
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

  test("renders consented contact fields when open", () => {
    renderModal(
      <ContactAgentModal
        open
        onClose={() => {}}
        listing={{ id: 1, title: "Beach Villa" }}
        contact={{
          displayName: "Jane Agent",
          email: "jane@example.com",
          phone: "5016001234",
          showEmailPublic: true,
          showPhonePublic: true,
        }}
        onOpenSiteMessage={() => {}}
      />
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toMatch(/Jane Agent/i);
    expect(dialog.textContent).toMatch(/Beach Villa/i);
    expect(dialog.textContent).toMatch(/Phone/i);
    expect(dialog.textContent).toMatch(/Email/i);
    expect(dialog.textContent).toMatch(/Message via BelizeListings/i);
    expect(dialog.textContent).toMatch(/jane@example.com/);
    expect(dialog.textContent).toMatch(/\+501 600 1234/);
  });

  test("hides email from DOM when email visibility is disabled", () => {
    renderModal(
      <ContactAgentModal
        open
        onClose={() => {}}
        listing={{ id: 1, title: "Beach Villa" }}
        contact={{
          displayName: "Jane Agent",
          email: "hidden@example.com",
          phone: "5016001234",
          showEmailPublic: false,
          showPhonePublic: true,
        }}
        onOpenSiteMessage={() => {}}
      />
    );

    expect(document.body.textContent).not.toMatch(/hidden@example.com/);
    expect(document.body.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.body.textContent).toMatch(/\+501 600 1234/);
  });

  test("shows private-contact notice when no direct methods are public", () => {
    const { hasPublicDirectContactMethods } = require("../../lib/listingContactResolver");
    hasPublicDirectContactMethods.mockReturnValueOnce(false);

    renderModal(
      <ContactAgentModal
        open
        onClose={() => {}}
        listing={{ id: 1, title: "Beach Villa" }}
        contact={{
          displayName: "Jane Agent",
          showEmailPublic: false,
          showPhonePublic: false,
        }}
        onOpenSiteMessage={() => {}}
      />
    );

    expect(document.body.textContent).toMatch(/Direct contact details are private/i);
    expect(document.body.querySelector(`.${styles.privateContactNotice}`)).toBeTruthy();
    expect(document.body.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.body.querySelector('a[href^="tel:"]')).toBeNull();
  });

  test("returns null when closed", () => {
    renderModal(
      <ContactAgentModal open={false} onClose={() => {}} listing={{ id: 1 }} />
    );
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });
});
