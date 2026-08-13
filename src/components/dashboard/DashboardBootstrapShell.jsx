import SiteNav from "@/components/SiteNav";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

/**
 * Safe loading surface while dashboard router/auth bootstrap completes.
 * Prevents blank/null main content during deep-link navigation.
 */
export default function DashboardBootstrapShell({ label = "Loading dashboard" }) {
  return (
    <div className={`${styles.page} ${styles.dashboardWorkspace}`}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <div className={loadingStyles.loadingMain} aria-busy="true" aria-label={label} />
      </main>
    </div>
  );
}
