/** Identity copy + tone keys for multi-role dashboard shells (single platform, adaptive surfaces). */
export const DASHBOARD_ROLE = {
  agent: "agent",
  broker: "broker",
  operator: "operator",
  admin: "admin",
};

export const DASHBOARD_ROLE_META = {
  [DASHBOARD_ROLE.agent]: {
    badgeLabel: "Licensed Agent",
    tone: "agent",
    defaultSubtitle: "Manage listings, visibility, and publishing in one place.",
  },
  [DASHBOARD_ROLE.broker]: {
    badgeLabel: "Brokerage Director",
    tone: "broker",
    defaultSubtitle: "Team inventory, quality, and operational oversight.",
  },
  [DASHBOARD_ROLE.operator]: {
    badgeLabel: "Operations Control",
    tone: "operator",
    defaultSubtitle: "Lifecycle governance and public inventory integrity.",
  },
  [DASHBOARD_ROLE.admin]: {
    badgeLabel: "Platform Administrator",
    tone: "admin",
    defaultSubtitle: "Full ecosystem visibility and controls.",
  },
};
