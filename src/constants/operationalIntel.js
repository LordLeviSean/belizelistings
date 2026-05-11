/**
 * Operational intelligence layer — health tiers, feed semantics, tone labels.
 * Colors reference CSS variables in `OperationalIntel.module.css`.
 */

export const LISTING_HEALTH_TIER = Object.freeze({
  EXCELLENT: "excellent",
  HEALTHY: "healthy",
  NEEDS_ATTENTION: "needs_attention",
  CRITICAL: "critical",
});

export const LISTING_HEALTH_LABEL = Object.freeze({
  [LISTING_HEALTH_TIER.EXCELLENT]: "Excellent",
  [LISTING_HEALTH_TIER.HEALTHY]: "Healthy",
  [LISTING_HEALTH_TIER.NEEDS_ATTENTION]: "Needs attention",
  [LISTING_HEALTH_TIER.CRITICAL]: "Critical",
});

/** Feed event kinds — realtime-ready; extend without breaking consumers */
export const AGENT_FEED_EVENT = Object.freeze({
  LIFECYCLE: "lifecycle",
  HEALTH: "health",
  FRESHNESS: "freshness",
  DRAFT: "draft",
  IMAGE: "image",
});
