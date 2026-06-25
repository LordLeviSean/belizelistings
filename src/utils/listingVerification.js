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

/** Admin dashboard label — reads verification_status only. */
export function getListingVerificationAdminLabel(listing = {}) {
  return isListingCardVerified(listing) ? "Verified" : "Unverified";
}

/**
 * Future public trust copy — not wired to UI yet.
 * Uses verified_at when present; falls back to generic BelizeListings attribution.
 * @param {object} listing
 * @returns {{ headline: string, detail: string|null, verifiedAt: string|null }}
 */
export function getListingVerificationTrustCopy(listing = {}) {
  const verified = isListingCardVerified(listing);
  if (!verified) {
    return { headline: "Unverified listing", detail: null, verifiedAt: null };
  }
  const verifiedAt = listing?.verified_at || null;
  return {
    headline: "Verified by BelizeListings",
    detail: verifiedAt ? `Verified on ${new Date(verifiedAt).toLocaleDateString()}` : null,
    verifiedAt,
  };
}
