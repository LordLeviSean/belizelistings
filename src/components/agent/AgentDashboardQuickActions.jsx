import Link from "next/link";
import styles from "@/styles/Dashboard.module.css";
import { AGENT_DASHBOARD_COPY } from "@/constants/dashboardAgentConfig";

/**
 * Agent Overview quick actions — operational shortcuts only.
 */
export default function AgentDashboardQuickActions({
  createDisabled = false,
  username = null,
}) {
  const linkButtonStyle = {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    marginTop: 8,
  };

  const profileHref = username ? `/agents/${encodeURIComponent(username)}` : null;

  return (
    <aside className={styles.card} aria-label="Quick actions">
      <h3 className={styles.sectionTitle}>{AGENT_DASHBOARD_COPY.quickActionsTitle}</h3>
      {createDisabled ? (
        <button
          type="button"
          className={`${styles.primaryButton} ${styles.userPrimaryDisabled}`}
          disabled
          aria-disabled="true"
        >
          {AGENT_DASHBOARD_COPY.quickActionCreateListing}
        </button>
      ) : (
        <Link
          className={styles.primaryButton}
          href="/dashboard/create"
          style={{ ...linkButtonStyle, marginTop: 0 }}
        >
          {AGENT_DASHBOARD_COPY.quickActionCreateListing}
        </Link>
      )}
      {profileHref ? (
        <Link className={styles.primaryButton} href={profileHref} style={linkButtonStyle}>
          {AGENT_DASHBOARD_COPY.quickActionViewPublicProfile}
        </Link>
      ) : null}
      <Link
        className={styles.primaryButton}
        href="/dashboard/agent?tab=profile"
        style={linkButtonStyle}
      >
        {AGENT_DASHBOARD_COPY.quickActionEditProfile}
      </Link>
      <Link
        className={styles.primaryButton}
        href="/dashboard/agent?tab=inbox"
        style={linkButtonStyle}
      >
        {AGENT_DASHBOARD_COPY.quickActionViewInbox}
      </Link>
      <Link
        className={styles.primaryButton}
        href="/dashboard/agent?tab=viewings"
        style={linkButtonStyle}
      >
        {AGENT_DASHBOARD_COPY.quickActionViewViewings}
      </Link>
      <Link className={styles.primaryButton} href="/" style={linkButtonStyle}>
        {AGENT_DASHBOARD_COPY.quickActionBrowseMarketplace}
      </Link>
    </aside>
  );
}
