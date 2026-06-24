/** Simultaneous non-draft, non-archived listings — production targets. */
export const PUBLIC_USER_ACTIVE_LISTING_CAP = 5;
export const AGENT_ACTIVE_LISTING_CAP = 25;
export const BROKERAGE_ACTIVE_LISTING_CAP = 100;

/**
 * Optional QA / beta override (inlined at build via `NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE`).
 * When set to a positive integer, replaces tier-specific caps for all quota-capped tiers.
 */
export function readBetaListingCapOverride() {
  if (typeof process === "undefined") return null;
  const raw = process.env.NEXT_PUBLIC_BETA_LISTING_CAP_OVERRIDE;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * @param {string} tier from `resolveTierFromProfile`
 * @returns {number|null} cap when tier is quota-capped; null when unlimited (admin)
 */
export function resolveTierActiveListingCap(tier) {
  const betaOverride = readBetaListingCapOverride();
  if (betaOverride != null) return betaOverride;

  switch (tier) {
    case "public":
      return PUBLIC_USER_ACTIVE_LISTING_CAP;
    case "agent_free":
    case "agent_pro":
      return AGENT_ACTIVE_LISTING_CAP;
    case "brokerage":
      return BROKERAGE_ACTIVE_LISTING_CAP;
    case "admin":
      return null;
    default:
      return PUBLIC_USER_ACTIVE_LISTING_CAP;
  }
}
