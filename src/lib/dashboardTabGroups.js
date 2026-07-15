/** Workspace vs Activity tab clustering for dashboard shells. */
export const DASHBOARD_TAB_GROUP = Object.freeze({
  WORKSPACE: "workspace",
  ACTIVITY: "activity",
});

export function partitionDashboardTabs(tabs = []) {
  const workspace = [];
  const activity = [];
  for (const tab of tabs) {
    const group = tab.group || (tab.crm ? DASHBOARD_TAB_GROUP.ACTIVITY : DASHBOARD_TAB_GROUP.WORKSPACE);
    if (group === DASHBOARD_TAB_GROUP.ACTIVITY) activity.push(tab);
    else workspace.push(tab);
  }
  return { workspace, activity };
}

/** Compact tab count chip — returns null when zero. */
export function formatTabCountChip(count) {
  const n = Math.floor(Number(count) || 0);
  if (n <= 0) return null;
  return n > 99 ? "99+" : String(n);
}
