import {
  deriveAgentProfileRegions,
  fetchAgentDirectory,
  fetchAgentPublicProfile,
  groupPublicListingsByUserId,
} from "./agentPublicProfile";

describe("groupPublicListingsByUserId", () => {
  test("counts only rows with id that resolve to published lifecycle", () => {
    const rows = [
      { user_id: "a1", status: "approved", id: "l1" },
      { user_id: "a1", status: "pending", id: "l2" },
      { user_id: "a2", lifecycle_status: "approved", status: "draft", id: "l3" },
      { user_id: "a1", status: "approved" },
    ];

    const grouped = groupPublicListingsByUserId(rows);

    expect(grouped.a1).toHaveLength(1);
    expect(grouped.a1[0].id).toBe("l1");
    expect(grouped.a2).toHaveLength(1);
    expect(grouped.a2[0].id).toBe("l3");
  });

  test("returns empty object for no public rows", () => {
    expect(groupPublicListingsByUserId([{ user_id: "a1", status: "draft", id: "l1" }])).toEqual({});
  });
});

describe("deriveAgentProfileRegions", () => {
  test("uses region_slug and district via canonical region resolver", () => {
    const regions = deriveAgentProfileRegions([
      { district: "belize", region_slug: "belize" },
      { region_slug: "corozal" },
    ]);
    expect(regions).toEqual(expect.arrayContaining(["belize", "corozal"]));
    expect(regions).toHaveLength(2);
  });
});

function createMockSupabase({ profiles = [], listings = [] }) {
  const listingsByUser = listings.reduce((acc, row) => {
    const uid = row.user_id;
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(row);
    return acc;
  }, {});

  const buildListingsQuery = () => {
    let userId = "";
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn((col, val) => {
        if (col === "user_id") userId = val;
        return chain;
      }),
      order: jest.fn(() => chain),
      limit: jest.fn(() =>
        Promise.resolve({
          data: listingsByUser[userId] || [],
          error: null,
        })
      ),
    };
    return chain;
  };

  return {
    from: jest.fn((table) => {
      if (table === "profiles") {
        const filters = [];
        const chain = {
          select: jest.fn(() => chain),
          eq: jest.fn((col, val) => {
            filters.push({ col, val });
            return chain;
          }),
          in: jest.fn(() => chain),
          not: jest.fn(() => chain),
          order: jest.fn(() =>
            Promise.resolve({
              data: profiles.filter((p) => ["agent", "broker"].includes(p.role) && p.username),
              error: null,
            })
          ),
          maybeSingle: jest.fn(() => {
            const usernameFilter = filters.find((f) => f.col === "username");
            const profile = usernameFilter
              ? profiles.find((p) => p.username === usernameFilter.val)
              : null;
            return Promise.resolve({ data: profile || null, error: null });
          }),
        };
        return chain;
      }
      if (table === "listings") {
        return buildListingsQuery();
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("fetchAgentDirectory", () => {
  const mikasaListings = [
    { id: "l1", user_id: "u-mikasa", status: "approved", district: "belize", region_slug: "belize" },
    { id: "l2", user_id: "u-mikasa", status: "approved", district: "corozal", region_slug: "corozal" },
    {
      id: "l3",
      user_id: "u-mikasa",
      status: "draft",
      lifecycle_status: "approved",
      district: "orange-walk",
      region_slug: "orange-walk",
    },
    { id: "l4", user_id: "u-mikasa", status: "pending", district: "belize" },
  ];

  const profiles = [
    { id: "u-mikasa", username: "mikasa", role: "agent" },
    { id: "u-other", username: "other", role: "agent" },
  ];

  test("listingCount matches fetchAgentPublicProfile for the same agent", async () => {
    const supabase = createMockSupabase({ profiles, listings: mikasaListings });

    const directory = await fetchAgentDirectory(supabase);
    const profile = await fetchAgentPublicProfile(supabase, "mikasa");

    const mikasaDirectory = directory.agents.find((a) => a.profile.username === "mikasa");
    expect(mikasaDirectory).toBeDefined();
    expect(mikasaDirectory.listingCount).toBe(3);
    expect(profile.listings).toHaveLength(3);
    expect(mikasaDirectory.listingCount).toBe(profile.listings.length);
  });

  test("does not zero counts when legacy batch select would fail on missing region column", async () => {
    const supabase = createMockSupabase({ profiles, listings: mikasaListings });
    const { agents } = await fetchAgentDirectory(supabase);
    const mikasa = agents.find((a) => a.profile.username === "mikasa");

    expect(mikasa.listingCount).toBe(3);
    expect(mikasa.regions).toEqual(expect.arrayContaining(["belize", "corozal", "orange-walk"]));
  });

  test("returns zero counts for agents with no public inventory", async () => {
    const supabase = createMockSupabase({ profiles, listings: mikasaListings });
    const { agents } = await fetchAgentDirectory(supabase);
    const other = agents.find((a) => a.profile.username === "other");

    expect(other.listingCount).toBe(0);
    expect(other.regions).toEqual([]);
  });
});
