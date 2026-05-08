import { PLATFORM_TIERS } from "./operationalModel";

export const VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED: "verified",
  REVOKED: "revoked",
});

export const TRUST_ENTITY_TYPES = Object.freeze({
  AGENT: "agent",
  BROKERAGE: "brokerage",
  INVENTORY: "inventory",
  CLOSING: "closing",
});

export const ACTIVITY_SIGNAL_TYPES = Object.freeze({
  RECENTLY_ADDED: "recently_added",
  RECENTLY_VERIFIED: "recently_verified",
  RECENTLY_RENTED: "recently_rented",
  RECENTLY_SOLD: "recently_sold",
  UPDATED_TODAY: "updated_today",
  FRESH_INVENTORY: "fresh_inventory",
  NEWLY_APPROVED: "newly_approved",
});

export const TRUST_VISIBILITY_SCOPE = Object.freeze({
  INTERNAL: "internal",
  PUBLIC: "public",
});

export const TRUST_VISIBILITY_RULES = Object.freeze({
  moderation_quality: TRUST_VISIBILITY_SCOPE.INTERNAL,
  freshness_warning: TRUST_VISIBILITY_SCOPE.INTERNAL,
  operational_review_state: TRUST_VISIBILITY_SCOPE.INTERNAL,
  verified_agent: TRUST_VISIBILITY_SCOPE.PUBLIC,
  verified_inventory: TRUST_VISIBILITY_SCOPE.PUBLIC,
  verified_closings: TRUST_VISIBILITY_SCOPE.PUBLIC,
  active_inventory_count: TRUST_VISIBILITY_SCOPE.PUBLIC,
  brokerage_affiliation: TRUST_VISIBILITY_SCOPE.PUBLIC,
});

const TRUST_TIER_CAPABILITIES = Object.freeze({
  [PLATFORM_TIERS.PUBLIC]: {
    canDisplayIdentityBadge: false,
    canDisplayPortfolioMetrics: false,
    canDisplayClosingHistory: false,
    canDisplayBrokerageAffiliation: false,
  },
  [PLATFORM_TIERS.AGENT_FREE]: {
    canDisplayIdentityBadge: false,
    canDisplayPortfolioMetrics: true,
    canDisplayClosingHistory: false,
    canDisplayBrokerageAffiliation: true,
  },
  [PLATFORM_TIERS.AGENT_PRO]: {
    canDisplayIdentityBadge: true,
    canDisplayPortfolioMetrics: true,
    canDisplayClosingHistory: true,
    canDisplayBrokerageAffiliation: true,
  },
  [PLATFORM_TIERS.BROKERAGE]: {
    canDisplayIdentityBadge: true,
    canDisplayPortfolioMetrics: true,
    canDisplayClosingHistory: true,
    canDisplayBrokerageAffiliation: true,
  },
  [PLATFORM_TIERS.ADMIN]: {
    canDisplayIdentityBadge: true,
    canDisplayPortfolioMetrics: true,
    canDisplayClosingHistory: true,
    canDisplayBrokerageAffiliation: true,
  },
});

function normalizeStatus(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === VERIFICATION_STATUS.PENDING) return VERIFICATION_STATUS.PENDING;
  if (key === VERIFICATION_STATUS.VERIFIED) return VERIFICATION_STATUS.VERIFIED;
  if (key === VERIFICATION_STATUS.REVOKED) return VERIFICATION_STATUS.REVOKED;
  return VERIFICATION_STATUS.UNVERIFIED;
}

export function getTrustTierCapabilities(tier) {
  return TRUST_TIER_CAPABILITIES[tier] || TRUST_TIER_CAPABILITIES[PLATFORM_TIERS.PUBLIC];
}

export function resolveProfileVerification(profile = {}) {
  const status = normalizeStatus(
    profile?.verification_status ||
      profile?.agent_verification_status ||
      profile?.verification?.status
  );
  const verifiedAt =
    profile?.verified_at ||
    profile?.verification_at ||
    profile?.verification?.verified_at ||
    null;
  const brokerageId =
    profile?.brokerage_id ||
    profile?.brokerage?.id ||
    profile?.brokerage_affiliation_id ||
    null;

  return {
    status,
    verifiedAt,
    brokerageId,
    isVerified: status === VERIFICATION_STATUS.VERIFIED,
  };
}

export function canShowTrustSignal(signalKey, scope = TRUST_VISIBILITY_SCOPE.INTERNAL) {
  const requiredScope = TRUST_VISIBILITY_RULES[signalKey] || TRUST_VISIBILITY_SCOPE.INTERNAL;
  if (scope === TRUST_VISIBILITY_SCOPE.INTERNAL) return true;
  return requiredScope === TRUST_VISIBILITY_SCOPE.PUBLIC;
}

