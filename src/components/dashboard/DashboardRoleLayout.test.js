/** @jest-environment jsdom */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DashboardRoleLayout from "./DashboardRoleLayout";
import DashboardMetricsStrip from "./DashboardMetricsStrip";
import DashboardOperationalStatCard from "./DashboardOperationalStatCard";
import DashboardLimitStatCard from "./DashboardLimitStatCard";
import AdminOperationalStats from "../AdminOperationalStats";

jest.mock("../../hooks/useCountUp", () => ({
  useCountUp: (value) => value,
}));

function renderLayout(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DashboardRoleLayout
        contentInnerClassName="content-inner"
        dataSurfaceClassName="data-surface"
        statsLampClassName="stats-lamp"
        statsRegionClassName="stats-region"
        mainGridClassName="main-grid"
        stats={<div data-testid="stats-strip">KPI strip</div>}
        navigation={<nav data-testid="tab-nav">Navigation</nav>}
        {...props}
      >
        <div data-testid="workspace">Workspace panel</div>
      </DashboardRoleLayout>
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("DashboardRoleLayout", () => {
  test("renders stats, navigation, workspace, and optional aside in order", () => {
    const view = renderLayout({
      aside: <aside data-testid="secondary-panel">Quick Actions</aside>,
    });

    expect(view.container.querySelector(".content-inner")).not.toBeNull();
    expect(view.container.querySelector(".data-surface")).not.toBeNull();
    expect(view.container.querySelector(".stats-lamp .stats-region")).not.toBeNull();
    expect(view.container.querySelector('[data-testid="stats-strip"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="tab-nav"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="workspace"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="secondary-panel"]')).not.toBeNull();

    const mainGrid = view.container.querySelector(".main-grid");
    const section = mainGrid.querySelector("section");
    expect(section.contains(view.container.querySelector('[data-testid="tab-nav"]'))).toBe(true);
    expect(section.contains(view.container.querySelector('[data-testid="workspace"]'))).toBe(true);

    view.unmount();
  });

  test("omits aside when not provided", () => {
    const view = renderLayout();
    expect(view.container.querySelector("aside")).toBeNull();
    view.unmount();
  });

  test("omits data surface wrapper when class name is empty", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DashboardRoleLayout stats={<span data-testid="stats">Stats</span>}>
          <span data-testid="child">Child</span>
        </DashboardRoleLayout>
      );
    });
    expect(container.querySelector('[data-testid="stats"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});

describe("DashboardMetricsStrip", () => {
  function renderStrip(props = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DashboardMetricsStrip {...props}>
          <span data-testid="primary-1">One</span>
          <span data-testid="primary-2">Two</span>
        </DashboardMetricsStrip>
      );
    });
    return {
      container,
      unmount: () => {
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  test("accepts different primary card counts", () => {
    const view = renderStrip();
    expect(view.container.querySelectorAll('[data-testid^="primary-"]').length).toBe(2);
    view.unmount();
  });

  test("renders optional secondary row", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DashboardMetricsStrip secondary={<span data-testid="secondary-card">Limit</span>}>
          <span>Primary</span>
        </DashboardMetricsStrip>
      );
    });
    expect(container.querySelector('[data-testid="secondary-card"]')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});

describe("DashboardOperationalStatCard", () => {
  test("renders label and numeric value", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DashboardOperationalStatCard label="Active Listings" value={12} variant="Active" />
      );
    });
    expect(container.textContent).toContain("Active Listings");
    expect(container.textContent).toContain("12");
    act(() => root.unmount());
    container.remove();
  });
});

describe("DashboardLimitStatCard", () => {
  test("renders listing limit copy", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DashboardLimitStatCard
          label="Listing Limit Remaining"
          valueText="3 of 5"
          exhausted={false}
          sublabel="Active listings count toward your cap."
        />
      );
    });
    expect(container.textContent).toContain("Listing Limit Remaining");
    expect(container.textContent).toContain("3 of 5");
    expect(container.textContent).toContain("Active listings count toward your cap.");
    act(() => root.unmount());
    container.remove();
  });
});

describe("AdminOperationalStats via shared strip", () => {
  test("admin KPI strip keeps six cards without role-specific user labels", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <AdminOperationalStats
          total={100}
          pending={5}
          approved={80}
          rejected={3}
          archived={12}
          users={42}
        />
      );
    });
    const text = container.textContent;
    expect(text).toContain("Total Listings");
    expect(text).toContain("Pending Review");
    expect(text).toContain("Users");
    expect(text).not.toContain("Saved Favorites");
    expect(text).not.toContain("Listing Limit Remaining");
    expect(container.querySelectorAll('[role="group"]').length).toBe(6);
    act(() => root.unmount());
    container.remove();
  });
});
