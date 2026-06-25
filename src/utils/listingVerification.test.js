import {
  isListingCardVerified,
  resolveListingCardVerificationStatus,
  getListingVerificationAdminLabel,
  getListingVerificationTrustCopy,
} from "../utils/listingVerification";
import { VERIFICATION_STATUS } from "../constants/trustModel";

describe("listingVerification", () => {
  test("resolveListingCardVerificationStatus reads listing.verification_status only", () => {
    expect(resolveListingCardVerificationStatus({ verification_status: "verified" })).toBe(
      VERIFICATION_STATUS.VERIFIED
    );
    expect(resolveListingCardVerificationStatus({ verification_status: "unverified" })).toBe(
      VERIFICATION_STATUS.UNVERIFIED
    );
    expect(resolveListingCardVerificationStatus({})).toBe(VERIFICATION_STATUS.UNVERIFIED);
  });

  test("isListingCardVerified is true only for verified status", () => {
    expect(isListingCardVerified({ verification_status: "verified" })).toBe(true);
    expect(isListingCardVerified({ verification_status: "pending" })).toBe(false);
  });

  test("getListingVerificationAdminLabel reflects status only", () => {
    expect(getListingVerificationAdminLabel({ verification_status: "verified" })).toBe("Verified");
    expect(getListingVerificationAdminLabel({ verification_status: "unverified" })).toBe("Unverified");
  });

  test("getListingVerificationTrustCopy prepares future public copy", () => {
    const copy = getListingVerificationTrustCopy({
      verification_status: "verified",
      verified_at: "2026-06-25T12:00:00.000Z",
    });
    expect(copy.headline).toBe("Verified by BelizeListings");
    expect(copy.verifiedAt).toBe("2026-06-25T12:00:00.000Z");
    expect(getListingVerificationTrustCopy({ verification_status: "unverified" }).headline).toBe(
      "Unverified listing"
    );
  });
});
