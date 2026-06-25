import {
  shouldSkipVerificationRealtimeReload,
  UNVERIFY_CONFIRM_COPY,
} from "./adminListingTrustActionState";
import { buildListingVerificationPatch } from "../../lib/listingVerificationMutations";
import { VERIFICATION_STATUS } from "../../constants/trustModel";

describe("adminListingTrustActionState", () => {
  test("shouldSkipVerificationRealtimeReload blocks during verify action", () => {
    expect(shouldSkipVerificationRealtimeReload("listing-1:verify")).toBe(true);
  });

  test("shouldSkipVerificationRealtimeReload blocks while unverify modal is open", () => {
    expect(shouldSkipVerificationRealtimeReload("", "listing-1")).toBe(true);
    expect(shouldSkipVerificationRealtimeReload("listing-2:archive", "listing-1")).toBe(true);
  });

  test("shouldSkipVerificationRealtimeReload allows reload when idle", () => {
    expect(shouldSkipVerificationRealtimeReload("")).toBe(false);
    expect(shouldSkipVerificationRealtimeReload("listing-1:archive")).toBe(false);
    expect(shouldSkipVerificationRealtimeReload("", "")).toBe(false);
  });

  test("UNVERIFY_CONFIRM_COPY exposes remove verification labels", () => {
    expect(UNVERIFY_CONFIRM_COPY.confirmLabel).toBe("Remove Verification");
    expect(UNVERIFY_CONFIRM_COPY.title).toMatch(/remove verification/i);
  });

  test("verify/unverify patch cycle toggles status and metadata (10x simulation)", () => {
    let status = VERIFICATION_STATUS.UNVERIFIED;
    let verifiedAt = null;
    let verifiedBy = null;

    for (let cycle = 0; cycle < 10; cycle += 1) {
      const verifyPatch = buildListingVerificationPatch({
        verified: true,
        adminUserId: "admin-uuid",
      });
      status = verifyPatch.verification_status;
      verifiedAt = verifyPatch.verified_at;
      verifiedBy = verifyPatch.verified_by;
      expect(status).toBe(VERIFICATION_STATUS.VERIFIED);
      expect(verifiedAt).toBeTruthy();
      expect(verifiedBy).toBe("admin-uuid");

      const unverifyPatch = buildListingVerificationPatch({
        verified: false,
        adminUserId: "admin-uuid",
      });
      status = unverifyPatch.verification_status;
      verifiedAt = unverifyPatch.verified_at;
      verifiedBy = unverifyPatch.verified_by;
      expect(status).toBe(VERIFICATION_STATUS.UNVERIFIED);
      expect(verifiedAt).toBeNull();
      expect(verifiedBy).toBeNull();
    }
  });
});
