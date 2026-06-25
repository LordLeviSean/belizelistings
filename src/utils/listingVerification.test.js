import {
  isListingCardVerified,
  resolveListingCardVerificationStatus,
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
});
