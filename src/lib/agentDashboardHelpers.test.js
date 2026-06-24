import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { AGENT_INVENTORY_FILTERS } from "@/constants/dashboardAgentConfig";
import { filterAgentInventoryRows, prepareAgentInventoryRows } from "./agentDashboardHelpers";

function row(id, lifecycle) {
  return { id, lifecycle_status: lifecycle, status: lifecycle === "published" ? "approved" : lifecycle };
}

describe("filterAgentInventoryRows", () => {
  const rows = [
    row(1, LISTING_LIFECYCLE.PUBLISHED),
    row(2, LISTING_LIFECYCLE.PENDING_REVIEW),
    row(3, LISTING_LIFECYCLE.REJECTED),
    row(4, LISTING_LIFECYCLE.ARCHIVED),
    row(5, LISTING_LIFECYCLE.DRAFT),
  ];

  it("returns all rows for ALL filter", () => {
    expect(filterAgentInventoryRows(rows, AGENT_INVENTORY_FILTERS.ALL)).toHaveLength(5);
  });

  it("buckets active as published only", () => {
    const active = filterAgentInventoryRows(rows, AGENT_INVENTORY_FILTERS.ACTIVE);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(1);
  });

  it("buckets drafts only", () => {
    const drafts = filterAgentInventoryRows(rows, AGENT_INVENTORY_FILTERS.DRAFTS);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(5);
  });

  it("prepareAgentInventoryRows applies search", () => {
    const withTitles = rows.map((r) => ({ ...r, title: r.id === 1 ? "Placencia Villa" : "Other" }));
    const out = prepareAgentInventoryRows(withTitles, AGENT_INVENTORY_FILTERS.ALL, "placencia");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });
});
