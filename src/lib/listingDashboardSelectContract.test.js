import {
  LISTING_DASHBOARD_BASE_COLUMNS,
  LISTING_DASHBOARD_INTEL_COLUMNS,
  LISTING_DASHBOARD_LEGACY_BASE_COLUMNS,
  LISTING_DASHBOARD_MARKET_OPTIONAL_COLUMNS,
  LISTING_DASHBOARD_MINIMAL_CORE_COLUMNS,
  LISTING_DASHBOARD_SELECT_TIERS,
  auditListingDashboardSelectLiteral,
  buildListingDashboardSelect,
  buildListingDashboardTierAttemptOrder,
  executeListingDashboardSelectQuery,
  normalizeListingDashboardRows,
} from "./listingDashboardSelectContract";

describe("listingDashboardSelectContract", () => {
  test("core base columns retain ownership and lifecycle without requiring market fields", () => {
    expect(LISTING_DASHBOARD_BASE_COLUMNS).toContain("user_id");
    expect(LISTING_DASHBOARD_BASE_COLUMNS).toContain("lifecycle_status");
    expect(LISTING_DASHBOARD_BASE_COLUMNS).not.toContain("market_type");
    expect(LISTING_DASHBOARD_LEGACY_BASE_COLUMNS).toContain("user_id");
    expect(LISTING_DASHBOARD_LEGACY_BASE_COLUMNS).not.toContain("market_type");
    expect(LISTING_DASHBOARD_MINIMAL_CORE_COLUMNS).toEqual(
      expect.arrayContaining(["id", "user_id", "status"])
    );
  });

  test("market columns are optional tier extensions only", () => {
    const withMarket = buildListingDashboardSelect({ withImages: false, withMarket: true });
    const withoutMarket = buildListingDashboardSelect({ withImages: false });
    for (const col of LISTING_DASHBOARD_MARKET_OPTIONAL_COLUMNS) {
      expect(withMarket).toContain(col);
      expect(withoutMarket).not.toContain(col);
    }
  });

  test("minimal select retains user_id and lifecycle fields", () => {
    const minimal = buildListingDashboardSelect({ minimal: true });
    expect(minimal).toContain("user_id");
    expect(minimal).toContain("lifecycle_status");
    expect(minimal).toContain("moderation_status");
    expect(minimal).toContain("closed_at");
    expect(minimal).toContain("sold_at");
    expect(minimal).toContain("rented_at");
    expect(minimal).not.toContain("market_type");
  });

  test("legacy base select retains lifecycle fields for badge resolution", () => {
    const legacy = buildListingDashboardSelect({ legacyBase: true, withImages: false });
    expect(legacy).toContain("lifecycle_status");
    expect(legacy).toContain("closed_at");
  });

  test("every dashboard select tier includes lifecycle_status", () => {
    for (const tier of LISTING_DASHBOARD_SELECT_TIERS) {
      const select = buildListingDashboardSelect(tier);
      expect(select).toContain("lifecycle_status");
      expect(select).toContain("moderation_status");
      expect(select).toContain("closed_at");
      expect(select).toContain("sold_at");
      expect(select).toContain("rented_at");
    }
  });

  test("core base columns include closure timestamps for archive countdown", () => {
    expect(LISTING_DASHBOARD_BASE_COLUMNS).toEqual(
      expect.arrayContaining(["closed_at", "sold_at", "rented_at", "archived_at"])
    );
  });

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
      if (select.includes("listing_images")) {
        return {
          data: null,
          error: {
            message:
              "Could not find a relationship between 'listings' and 'listing_images' in the schema cache",
          },
        };
      }
      return {
        data: [{ id: "1", status: "approved", user_id: "u1", lifecycle_status: "published" }],
        error: null,
      };
    });

    expect(error).toBeNull();
    expect(terminal).toBe(false);
    expect(data).toHaveLength(1);
    expect(data[0].listing_images).toEqual([]);
    expect(data[0].lifecycle_status).toBe("published");
    expect(calls.some((s) => s.includes("view_count"))).toBe(false);
    expect(calls[0]).not.toContain("listing_images");
    expect(calls.every((s) => s.includes("lifecycle_status"))).toBe(true);
  });

  test("executeListingDashboardSelectQuery falls back when market_type column is absent", async () => {
    const calls = [];
    const { data, error } = await executeListingDashboardSelectQuery({}, async (select) => {
      calls.push(select);
      if (select.includes("market_type")) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'market_type' column of 'listings' in the schema cache",
          },
        };
      }
      return {
        data: [{ id: "1", user_id: "owner-1", status: "approved", listing_type: null }],
        error: null,
      };
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].user_id).toBe("owner-1");
    expect(calls.some((s) => s.includes("market_type"))).toBe(true);
    expect(calls.some((s) => !s.includes("market_type") && s.includes("user_id"))).toBe(true);
  });

  test("SELECT tiers: market-optional first, no embed or intel on core attempts", () => {
    expect(LISTING_DASHBOARD_SELECT_TIERS.length).toBe(10);
    expect(LISTING_DASHBOARD_SELECT_TIERS[0]).toEqual({
      withImages: false,
      withIntel: false,
      withMarket: true,
    });
    expect(LISTING_DASHBOARD_SELECT_TIERS[1]).toEqual({ withImages: false, withIntel: false });
    expect(LISTING_DASHBOARD_SELECT_TIERS.at(-1)).toEqual({ minimal: true });
    const firstSelect = buildListingDashboardSelect(LISTING_DASHBOARD_SELECT_TIERS[0]);
    expect(firstSelect).not.toContain("listing_images");
    expect(firstSelect).not.toContain("view_count");
    expect(firstSelect).toContain("market_type");
    const coreSelect = buildListingDashboardSelect(LISTING_DASHBOARD_SELECT_TIERS[1]);
    expect(coreSelect).not.toContain("market_type");
    expect(coreSelect).toContain("user_id");
  });

  test("buildListingDashboardTierAttemptOrder defaults to contract order", () => {
    expect(buildListingDashboardTierAttemptOrder(LISTING_DASHBOARD_SELECT_TIERS)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});
