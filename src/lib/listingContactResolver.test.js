import {
  normalizeListingOwnerContact,
  resolveListingContact,
  resolveListingContactFromListingFields,
  resolveListingContactFromProfile,
} from "./listingContactResolver";
import { formatCapitalizedProfileDisplayName } from "./profileDisplayName";

describe("listingContactResolver", () => {
  it("capitalizes display name from username", () => {
    expect(formatCapitalizedProfileDisplayName({ username: "maria_agent" })).toBe("Maria Agent");
  });

  it("resolveListingContactFromProfile respects privacy flags", () => {
    const contact = resolveListingContactFromProfile({
      id: "u1",
      username: "belize_agent",
      email: "agent@example.com",
      phone: "+501 600 1111",
      whatsapp: "+501 600 2222",
      show_email_public: false,
      show_phone_public: true,
    });
    expect(contact.displayName).toBe("Belize Agent");
    expect(contact.phone).toBe("+501 600 1111");
    expect(contact.whatsapp).toBe("+501 600 2222");
    expect(contact.email).toBeNull();
  });

  it("falls back whatsapp to phone when whatsapp unset", () => {
    const contact = resolveListingContactFromProfile({
      id: "u1",
      username: "agent",
      phone: "+501 600 3333",
    });
    expect(contact.whatsapp).toBe("+501 600 3333");
  });

  it("resolveListingContact prefers profile over legacy listing fields", () => {
    const listing = {
      agent_phone: "legacy-phone",
      agent_email: "legacy@example.com",
      agent_name: "legacy name",
    };
    const profile = {
      id: "u1",
      username: "modern_agent",
      email: "modern@example.com",
      phone: "+501 600 4444",
    };
    const contact = resolveListingContact(listing, profile);
    expect(contact.phone).toBe("+501 600 4444");
    expect(contact.email).toBe("modern@example.com");
  });

  it("resolveListingContactFromListingFields maps legacy columns", () => {
    const contact = resolveListingContactFromListingFields({
      agent_name: "Jane Doe",
      agent_phone: "+501 622 0000",
      agent_email: "jane@example.com",
      brokerage_name: "Coastal Realty",
    });
    expect(contact.displayName).toBe("Jane Doe");
    expect(contact.brokerageName).toBe("Coastal Realty");
  });

  it("normalizeListingOwnerContact handles RPC shape", () => {
    const contact = normalizeListingOwnerContact({
      user_id: "abc",
      username: "rpc_user",
      phone: "+501 600 5555",
      email: "rpc@example.com",
      brokerage_name: "RPC Brokerage",
    });
    expect(contact.userId).toBe("abc");
    expect(contact.displayName).toBe("Rpc User");
    expect(contact.brokerageName).toBe("RPC Brokerage");
  });
});
