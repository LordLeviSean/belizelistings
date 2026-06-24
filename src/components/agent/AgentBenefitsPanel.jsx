import { memo } from "react";
import Link from "next/link";
import { AGENT_BENEFITS, AGENT_DASHBOARD_COPY } from "@/constants/dashboardAgentConfig";
import styles from "@/styles/Dashboard.module.css";

function AgentBenefitsPanel({ username }) {
  const profileHref = username ? `/agents/${encodeURIComponent(username)}` : null;

  return (
    <section className={styles.userActionPanel} aria-label={AGENT_DASHBOARD_COPY.benefitsHeadline}>
      <h2 className={styles.userActionHeadline} style={{ marginBottom: 12 }}>
        {AGENT_DASHBOARD_COPY.benefitsHeadline}
      </h2>
      <ul className={styles.agentBenefitsList}>
        {AGENT_BENEFITS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {profileHref ? (
        <div className={styles.linkRow} style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href={profileHref} className={styles.dashboardLink}>
            View Public Profile
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export default memo(AgentBenefitsPanel);
