import { memo } from "react";
import Link from "next/link";
import { Gauge } from "lucide-react";
import {
  AGENT_BENEFITS,
  AGENT_DASHBOARD_COPY,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
} from "@/constants/dashboardAgentConfig";
import { formatUserListingSlotsUsedLabel } from "@/constants/dashboardUserConfig";
import styles from "@/styles/Dashboard.module.css";

function AgentBenefitsPanel({
  username,
  activeListings = 0,
  listingCap = 25,
  limitExhausted = false,
}) {
  const profileHref = username ? `/agents/${encodeURIComponent(username)}` : null;
  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const used = Math.max(0, Number(activeListings) || 0);
  const capDisplay = finiteCap ? listingCap : listingCap;

  return (
    <section className={styles.userTierBlock} aria-label={AGENT_DASHBOARD_COPY.benefitsHeadline}>
      <div className={styles.userTierHeader}>
        <h2 className={styles.userTierTitle}>{AGENT_DASHBOARD_COPY.benefitsHeadline}</h2>
        <p className={styles.userTierSubtext}>{AGENT_DASHBOARD_COPY.benefitsSubtext}</p>
      </div>

      {finiteCap ? (
        <div
          className={`${styles.userListingLimitPanel} ${
            limitExhausted ? styles.userListingLimitPanelExhausted : ""
          }`}
          aria-label={formatUserListingSlotsUsedLabel(used, capDisplay)}
        >
          <div className={styles.userListingLimitCopy}>
            <p className={styles.userListingLimitLabel}>{AGENT_DASHBOARD_COPY.listingLimitPanelLabel}</p>
            <p className={styles.userListingLimitSlots} aria-hidden="true">
              {formatUserListingSlotsUsedLabel(used, capDisplay)}
            </p>
            <p className={styles.userListingLimitHint} aria-hidden="true">
              {limitExhausted
                ? AGENT_DASHBOARD_COPY.listingLimitExhaustedHint
                : AGENT_DASHBOARD_COPY.listingLimitSubtext}
            </p>
          </div>
          <Gauge className={styles.userListingLimitGauge} aria-hidden />
        </div>
      ) : null}

      <ul className={styles.agentBenefitsList}>
        {AGENT_BENEFITS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className={styles.userTierActions}>
        {profileHref ? (
          <Link className={styles.primaryButton} href={profileHref}>
            {AGENT_DASHBOARD_COPY.quickActionViewPublicProfile}
          </Link>
        ) : null}
        <Link className={styles.primaryButton} href="/dashboard/agent?tab=profile">
          {AGENT_DASHBOARD_COPY.quickActionEditProfile}
        </Link>
      </div>
    </section>
  );
}

export default memo(AgentBenefitsPanel);
