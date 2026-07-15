import { partitionDashboardTabs, formatTabCountChip } from "@/lib/dashboardTabGroups";
import styles from "./DashboardTabNav.module.css";

/**
 * Grouped dashboard tab navigation — Workspace + Activity clusters with optional count chips.
 */
export default function DashboardTabNav({
  tabs = [],
  activeTab,
  onSelect,
  tabCounts = {},
  variant = "pill",
  activeTabClassName = "",
  ariaLabel = "Dashboard sections",
}) {
  const { workspace, activity } = partitionDashboardTabs(tabs);
  const useLinkStyle = variant === "link";

  const renderTab = (tab) => {
    const isActive = activeTab === tab.id;
    const chip = formatTabCountChip(tabCounts[tab.id]);
    const className = [
      styles.tab,
      useLinkStyle ? styles.tabLink : "",
      isActive ? (useLinkStyle ? styles.tabLinkActive : styles.tabActive) : "",
      isActive && activeTabClassName ? activeTabClassName : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={className}
        onClick={() => onSelect?.(tab.id)}
      >
        <span>{tab.label}</span>
        {chip ? (
          <span className={styles.chip} aria-label={`${chip} pending`}>
            {chip}
          </span>
        ) : null}
      </button>
    );
  };

  if (!workspace.length && !activity.length) return null;

  return (
    <div className={styles.nav} role="tablist" aria-label={ariaLabel}>
      {workspace.length ? (
        <div className={styles.cluster}>
          <p className={styles.clusterLabel}>Workspace</p>
          {workspace.map(renderTab)}
        </div>
      ) : null}
      {workspace.length && activity.length ? <div className={styles.divider} aria-hidden /> : null}
      {activity.length ? (
        <div className={styles.cluster}>
          <p className={styles.clusterLabel}>Activity</p>
          {activity.map(renderTab)}
        </div>
      ) : null}
    </div>
  );
}
