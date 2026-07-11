/** @jest-environment node */

jest.mock("./listingContactResolver", () => ({
  fetchListingOwnerContact: jest.fn(),
}));

import { fetchListingOwnerContact } from "./listingContactResolver";
import { resolveListingAgentUserId, resolveListingAgentUserIdAsync } from "./listingInquiryTargets";

describe("resolveListingAgentUserId", () => {
  test("prefers listing.user_id when present", () => {
    expect(
      resolveListingAgentUserId({ id: 1, user_id: "owner-1" }, { userId: "contact-1" })
    ).toBe("owner-1");
  });

  test("falls back to contact.userId when listing user_id is hidden", () => {
    expect(resolveListingAgentUserId({ id: 1 }, { userId: "owner-from-rpc" })).toBe("owner-from-rpc");
  });

  test("returns null when neither source is available", () => {
    expect(resolveListingAgentUserId({ id: 1 }, null)).toBeNull();
  });

  test("resolveListingAgentUserIdAsync fetches owner contact RPC when needed", async () => {
    fetchListingOwnerContact.mockResolvedValue({
      contact: { userId: "rpc-owner" },
      error: null,
      unavailable: false,
    });
    const client = {};
    await expect(resolveListingAgentUserIdAsync(client, { id: 99 }, null)).resolves.toBe("rpc-owner");
    expect(fetchListingOwnerContact).toHaveBeenCalledWith(client, 99);
  });
});
