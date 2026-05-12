import { DASHBOARD_ROLE_META } from "@/constants/dashboardRoles";
import ambientOceanStyles from "@/styles/ambientOcean.module.css";
import RoleBadge from "./RoleBadge";
import styles from "./DashboardShell.module.css";

/**
 * Shared dashboard chrome: operational identity strip + children (panels, tables, etc.).
 */
export default function DashboardShell({ roleKey, title, subtitle, children }) {
  const meta = DASHBOARD_ROLE_META[roleKey] || DASHBOARD_ROLE_META.agent;
  const sub = subtitle ?? meta.defaultSubtitle;

  return (
    <div className={styles.shell} data-dashboard-role={roleKey}>
      <header className={styles.identity}>
        <span className={ambientOceanStyles.ambientHeroStrip} aria-hidden />
        <div className={styles.identityForeground}>
          <div className={styles.headline}>
            <h1 className={styles.title}>{title}</h1>
            {sub ? <p className={styles.subtitle}>{sub}</p> : null}
          </div>
          <RoleBadge roleKey={roleKey} />
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
