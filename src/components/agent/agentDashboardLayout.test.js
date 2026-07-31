/** @jest-environment jsdom */

jest.mock("../../lib/featureFlags", () => ({
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import AgentDashboardMetrics from "../agent/AgentDashboardMetrics";
import AgentDashboardQuickActions from "../agent/AgentDashboardQuickActions";
import AgentBenefitsPanel from "../agent/AgentBenefitsPanel";
import { partitionDashboardTabs } from "../../lib/dashboardTabGroups";
import dashboardStyles from "../../styles/Dashboard.module.css";
import {
  AGENT_DASHBOARD_TAB_IDS,
  AGENT_DASHBOARD_TABS,
  AGENT_DASHBOARD_COPY,
  AGENT_BENEFITS,
  formatAgentListingLimitExhaustedMessage,
} from "../../constants/dashboardAgentConfig";
import { AGENT_ACTIVE_LISTING_CAP } from "../../constants/listingTierCaps";

jest.mock("../../hooks/useCountUp", () => ({
  useCountUp: (value) => value,
}));

const AGENT_STATS_LABELS = [
  "Active Listings",
  "Pending Approval",
  "Rejected",
  "Archived",
  "Draft",
  "Inquiries",
];

describe("agent dashboard shared layout", () => {
  test("agent tabs partition into workspace and activity groups", () => {
    const { workspace, activity } = partitionDashboardTabs(AGENT_DASHBOARD_TABS);
    expect(workspace.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.OVERVIEW);
    expect(workspace.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.LISTINGS);
    expect(activity.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.INBOX);
    expect(activity.map((tab) => tab.id)).toContain(AGENT_DASHBOARD_TAB_IDS.VIEWINGS);
  });

  test("compact stats strip renders six KPIs without listing limit card", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <AgentDashboardMetrics
          activeListings={8}
          pendingListings={2}
          rejectedListings={1}
          archivedListings={3}
          draftListings={0}
          inquiriesCount={4}
          inquiriesUnavailable={false}
        />
      );
    });

    const text = container.textContent;
    for (const label of AGENT_STATS_LABELS) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain("Listing Limit Remaining");
    expect(text).not.toContain("Users");
    expect(text).not.toContain("Bulk Approve");
    expect(container.querySelectorAll('[role="group"]').length).toBe(6);
    expect(container.querySelector(`.${dashboardStyles.userOperationalStatsGrid}`)).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  test("quick actions expose agent operational shortcuts", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<AgentDashboardQuickActions username="coastalagent" />);
    });

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/dashboard/create");
    expect(hrefs).toContain("/agents/coastalagent");
    expect(hrefs).toContain("/dashboard/agent?tab=profile");
    expect(hrefs).toContain("/dashboard/agent?tab=inbox");
    expect(hrefs).toContain("/dashboard/agent?tab=viewings");
    expect(hrefs).toContain("/");
    expect(container.textContent).toContain(AGENT_DASHBOARD_COPY.quickActionsTitle);
    act(() => root.unmount());
    container.remove();
  });

  test("agent tools panel surfaces capacity and profile actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <AgentBenefitsPanel
          username="coastalagent"
          activeListings={8}
          listingCap={AGENT_ACTIVE_LISTING_CAP}
          limitExhausted={false}
        />
      );
    });

    const text = container.textContent;
    expect(text).toContain(AGENT_DASHBOARD_COPY.benefitsHeadline);
    expect(text).toContain("8 of 25 slots used");
    for (const benefit of AGENT_BENEFITS) {
      expect(text).toContain(benefit);
    }
    expect(text).toContain(AGENT_DASHBOARD_COPY.quickActionViewPublicProfile);
    expect(text).toContain(AGENT_DASHBOARD_COPY.quickActionEditProfile);
    act(() => root.unmount());
    container.remove();
  });

  test("agent listing limit exhausted copy references agent cap", () => {
    expect(formatAgentListingLimitExhaustedMessage(AGENT_ACTIVE_LISTING_CAP)).toMatch(/25 active listings/);
  });
});
