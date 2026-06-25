import {
  buildListingVerificationPatch,
  applyListingVerificationAction,
} from "../lib/listingVerificationMutations";
import { VERIFICATION_STATUS } from "../constants/trustModel";

describe("listingVerificationMutations", () => {
  test("buildListingVerificationPatch sets metadata on verify", () => {
    const patch = buildListingVerificationPatch({
      verified: true,
      adminUserId: "admin-uuid",
    });
    expect(patch.verification_status).toBe(VERIFICATION_STATUS.VERIFIED);
    expect(patch.verified_by).toBe("admin-uuid");
    expect(patch.verified_at).toBeTruthy();
  });

  test("buildListingVerificationPatch clears metadata on unverify", () => {
    const patch = buildListingVerificationPatch({
      verified: false,
      adminUserId: "admin-uuid",
    });
    expect(patch.verification_status).toBe(VERIFICATION_STATUS.UNVERIFIED);
    expect(patch.verified_by).toBeNull();
    expect(patch.verified_at).toBeNull();
  });

  test("applyListingVerificationAction rejects missing ids", async () => {
    const result = await applyListingVerificationAction({
      listingId: "",
      verified: true,
      adminUserId: "",
      client: {},
    });
    expect(result.ok).toBe(false);
  });
});
