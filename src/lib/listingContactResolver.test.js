/** @jest-environment node */

import {
  hasPublicDirectContactMethods,
  normalizeListingOwnerContact,
  resolveListingContact,
  resolveListingContactFromListingFields,
  resolveListingContactFromProfile,
} from "./listingContactResolver";

describe("listingContactResolver privacy", () => {
  test("resolveListingContactFromProfile hides email without explicit display consent", () => {
    const contact = resolveListingContactFromProfile({
      id: "u1",
      username: "belize_agent",
      email: "agent@example.com",
      phone: "+501 600 1111",
      show_email_public: true,
      show_phone_public: true,
    });
    expect(contact.displayName).toBe("Belize Agent");
    expect(contact.phone).toBe("+501 600 1111");
    expect(contact.email).toBeNull();
    expect(contact.showEmailPublic).toBe(false);
  });

  test("resolveListingContactFromProfile exposes email only with contact_email_display", () => {
    const contact = resolveListingContactFromProfile({
      id: "u1",
      username: "belize_agent",
      contact_email_display: "public@example.com",
      show_email_public: true,
      show_phone_public: true,
      phone: "+501 600 1111",
    });
    expect(contact.email).toBe("public@example.com");
    expect(contact.showEmailPublic).toBe(true);
  });

  test("legacy listing fields never expose email or phone", () => {
    const contact = resolveListingContactFromListingFields({
      agent_name: "Jane Doe",
      agent_phone: "+501 622 0000",
      agent_email: "jane@example.com",
      brokerage_name: "Coastal Realty",
    });
    expect(contact.displayName).toBe("Jane Doe");
    expect(contact.phone).toBeNull();
    expect(contact.email).toBeNull();
  });

  test("resolveListingContact prefers consented profile contact over legacy fields", () => {
    const listing = {
      agent_phone: "legacy-phone",
      agent_email: "legacy@example.com",
      agent_name: "legacy name",
    };
    const profile = {
      id: "u1",
      username: "modern_agent",
      email: "modern@example.com",
      contact_email_display: "public@example.com",
      show_email_public: true,
      phone: "+501 600 4444",
    };
    const contact = resolveListingContact(listing, profile);
    expect(contact.phone).toBe("+501 600 4444");
    expect(contact.email).toBe("public@example.com");
  });

  test("normalizeListingOwnerContact strips RPC email without display consent marker", () => {
    const contact = normalizeListingOwnerContact({
      user_id: "abc",
      username: "rpc_user",
      phone: "+501 600 5555",
      email: "rpc@example.com",
      show_email_public: true,
      show_phone_public: true,
    });
    expect(contact.phone).toBe("+501 600 5555");
    expect(contact.email).toBeNull();
  });

  test("hasPublicDirectContactMethods is false when all direct channels are hidden", () => {
    expect(
      hasPublicDirectContactMethods({
        displayName: "Agent",
        showEmailPublic: false,
        showPhonePublic: false,
      })
    ).toBe(false);
  });
});
