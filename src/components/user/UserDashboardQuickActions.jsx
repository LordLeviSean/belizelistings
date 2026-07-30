import Link from "next/link";
import styles from "@/styles/Dashboard.module.css";
import { USER_DASHBOARD_COPY } from "@/constants/dashboardUserConfig";

/**
 * User Overview quick actions — existing routes only, no admin/agent tools.
 */
export default function UserDashboardQuickActions({ createDisabled = false }) {
  const linkButtonStyle = {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    marginTop: 8,
  };

  return (
    <aside className={styles.card} aria-label="Quick actions">
      <h3 className={styles.sectionTitle}>{USER_DASHBOARD_COPY.quickActionsTitle}</h3>
      {createDisabled ? (
        <button
          type="button"
          className={`${styles.primaryButton} ${styles.userPrimaryDisabled}`}
          disabled
          aria-disabled="true"
        >
          {USER_DASHBOARD_COPY.quickActionCreateListing}
        </button>
      ) : (
        <Link
          className={styles.primaryButton}
          href="/dashboard/create"
          style={{ ...linkButtonStyle, marginTop: 0 }}
        >
          {USER_DASHBOARD_COPY.quickActionCreateListing}
        </Link>
      )}
      <Link className={styles.primaryButton} href="/dashboard/user?tab=profile" style={linkButtonStyle}>
        {USER_DASHBOARD_COPY.quickActionUpdateProfile}
      </Link>
      <Link className={styles.primaryButton} href="/favorites" style={linkButtonStyle}>
        {USER_DASHBOARD_COPY.quickActionSavedFavorites}
      </Link>
      <Link className={styles.primaryButton} href="/" style={linkButtonStyle}>
        {USER_DASHBOARD_COPY.quickActionBrowseListings}
      </Link>
    </aside>
  );
}
