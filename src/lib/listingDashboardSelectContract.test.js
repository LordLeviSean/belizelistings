import {
  LISTING_DASHBOARD_BASE_COLUMNS,
  LISTING_DASHBOARD_INTEL_COLUMNS,
  LISTING_DASHBOARD_SELECT_TIERS,
  auditListingDashboardSelectLiteral,
  buildListingDashboardSelect,
  buildListingDashboardTierAttemptOrder,
  executeListingDashboardSelectQuery,
  normalizeListingDashboardRows,
} from "./listingDashboardSelectContract";

describe("listingDashboardSelectContract", () => {
  test("base columns exclude operator and verification fields", () => {
    const blob = LISTING_DASHBOARD_BASE_COLUMNS.join(",");
    expect(blob).not.toMatch(/occupied_at/);
    expect(blob).not.toMatch(/verification/);
    expect(LISTING_DASHBOARD_BASE_COLUMNS).toContain("lifecycle_status");
    expect(LISTING_DASHBOARD_BASE_COLUMNS).toContain("moderation_status");
  });

  test("intel columns are optional tier only", () => {
    expect(LISTING_DASHBOARD_INTEL_COLUMNS).toEqual([
      "view_count",
      "favorite_count",
      "inquiry_count",
    ]);
    const withIntel = buildListingDashboardSelect({ withImages: false, withIntel: true });
    const withoutIntel = buildListingDashboardSelect({ withImages: false, withIntel: false });
    expect(withIntel).toContain("view_count");
    expect(withoutIntel).not.toContain("view_count");
  });

  test("audit rejects select(*) and forbidden snippets", () => {
    expect(auditListingDashboardSelectLiteral("*")).toContain("select(*) is forbidden");
    expect(auditListingDashboardSelectLiteral("id,occupied_at").join(" ")).toContain("occupied_at");
  });

  test("normalizeListingDashboardRows ensures empty listing_images array", () => {
    const out = normalizeListingDashboardRows([{ id: "a", status: "draft" }]);
    expect(out[0].listing_images).toEqual([]);
  });

  test("executeListingDashboardSelectQuery never probes intel; degrades embed then legacy base", async () => {
    const calls = [];
    const client = {};
    const { data, error, terminal } = await executeListingDashboardSelectQuery(client, async (select) => {
      calls.push(select);
      if (select.includes("view_count")) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'view_count' column of 'listings' in the schema cache",
          },
        };
      }
      if (select.includes("lifecycle_status")) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'lifecycle_status' column of 'listings' in the schema cache",
          },
        };
      }
      if (select.includes("listing_images")) {
        return {
          data: null,
          error: {
            message:
              "Could not find a relationship between 'listings' and 'listing_images' in the schema cache",
          },
        };
      }
      return { data: [{ id: "1", status: "approved", user_id: "u1" }], error: null };
    });

    expect(error).toBeNull();
    expect(terminal).toBe(false);
    expect(data).toHaveLength(1);
    expect(data[0].listing_images).toEqual([]);
    expect(calls.some((s) => s.includes("view_count"))).toBe(false);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[calls.length - 1]).not.toContain("listing_images");
  });

  test("SELECT tiers: no embed or intel on first attempt", () => {
    expect(LISTING_DASHBOARD_SELECT_TIERS.length).toBe(5);
    expect(LISTING_DASHBOARD_SELECT_TIERS[0]).toEqual({ withImages: false, withIntel: false });
    expect(LISTING_DASHBOARD_SELECT_TIERS[0].withIntel).toBe(false);
    expect(LISTING_DASHBOARD_SELECT_TIERS.at(-1)).toEqual({ minimal: true });
    const firstSelect = buildListingDashboardSelect(LISTING_DASHBOARD_SELECT_TIERS[0]);
    expect(firstSelect).not.toContain("listing_images");
    expect(firstSelect).not.toContain("view_count");
  });

  test("buildListingDashboardTierAttemptOrder defaults to contract order", () => {
    expect(buildListingDashboardTierAttemptOrder(LISTING_DASHBOARD_SELECT_TIERS)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });
});
