import { VERIFICATION_STATUS } from "../constants/trustModel";

/**
 * Card-level verification label from listing.verification_status only (not owner role at render time).
 * @param {object} listing
 * @returns {"verified"|"unverified"}
 */
export function resolveListingCardVerificationStatus(listing = {}) {
  const raw = String(listing?.verification_status || VERIFICATION_STATUS.UNVERIFIED)
    .trim()
    .toLowerCase();
  return raw === VERIFICATION_STATUS.VERIFIED
    ? VERIFICATION_STATUS.VERIFIED
    : VERIFICATION_STATUS.UNVERIFIED;
}

export function isListingCardVerified(listing = {}) {
  return resolveListingCardVerificationStatus(listing) === VERIFICATION_STATUS.VERIFIED;
}
