import { LISTING_HEALTH_TIER, LISTING_HEALTH_LABEL } from "@/constants/operationalIntel";
import opStyles from "./OperationalIntel.module.css";

const TIER_CLASS = {
  [LISTING_HEALTH_TIER.EXCELLENT]: opStyles.tierExcellent,
  [LISTING_HEALTH_TIER.HEALTHY]: opStyles.tierHealthy,
  [LISTING_HEALTH_TIER.NEEDS_ATTENTION]: opStyles.tierNeeds,
  [LISTING_HEALTH_TIER.CRITICAL]: opStyles.tierCritical,
};

export default function ListingHealthBadge({ tier }) {
  const t = TIER_CLASS[tier] ? tier : LISTING_HEALTH_TIER.HEALTHY;
  const label = LISTING_HEALTH_LABEL[t] || LISTING_HEALTH_LABEL[LISTING_HEALTH_TIER.HEALTHY];
  return (
    <span className={`${opStyles.healthBadge} ${TIER_CLASS[t]}`} data-health-tier={t}>
      {label}
    </span>
  );
}
