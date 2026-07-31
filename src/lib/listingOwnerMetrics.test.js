/** @jest-environment node */

jest.mock("./featureFlags", () => ({
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_CONVERSATIONS: true,
}));

import {
  applyListingMetricsToRows,
  fetchOwnerListingMetricsMap,
} from "./listingOwnerMetrics";

describe("listingOwnerMetrics", () => {
  test("applyListingMetricsToRows maps RPC fields onto listing rows", () => {
    const rows = applyListingMetricsToRows(
      [{ id: 10, title: "A" }, { id: 11, title: "B" }],
      {
        10: { views: 4, saves: 2, inquiries: 1 },
        11: { views: 0, saves: 0, inquiries: 0 },
      }
    );
    expect(rows[0]).toMatchObject({
      view_count: 4,
      favorite_count: 2,
      inquiry_count: 1,
    });
    expect(rows[1]).toMatchObject({
      view_count: 0,
      favorite_count: 0,
      inquiry_count: 0,
    });
  });

  test("fetchOwnerListingMetricsMap uses get_owner_listing_metrics RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ listing_id: 42, views: 9, saves: 3, inquiries: 2 }],
      error: null,
    });
    const client = { rpc };

    const { map, error } = await fetchOwnerListingMetricsMap(client, [42], "owner-1");

    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("get_owner_listing_metrics", { p_listing_ids: [42] });
    expect(map["42"]).toEqual({ views: 9, saves: 3, inquiries: 2 });
  });

  test("fallback counts active Inbox conversations and excludes schedule_viewing", async () => {
    const inMock = jest.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          listing_id: 5,
          listing_inquiries: { inquiry_type: "general" },
        },
        {
          id: "c2",
          listing_id: 5,
          listing_inquiries: { inquiry_type: "schedule_viewing" },
        },
        {
          id: "c3",
          listing_id: 6,
          listing_inquiries: { inquiry_type: "general" },
        },
      ],
      error: null,
    });
    const isMock = jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue({ in: inMock }),
    });
    const eqMock = jest.fn().mockReturnValue({ is: isMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } }),
      from: jest.fn(() => ({ select: selectMock })),
    };

    const { map } = await fetchOwnerListingMetricsMap(client, [5, 6], "owner-1");
    expect(client.from).toHaveBeenCalledWith("conversations");
    expect(map["5"].inquiries).toBe(1);
    expect(map["6"].inquiries).toBe(1);
    expect(map["5"].views).toBe(0);
  });

  test("fetchOwnerListingMetricsMap returns zeros for empty listing id list", async () => {
    const client = { rpc: jest.fn() };
    const { map, error } = await fetchOwnerListingMetricsMap(client, [], "owner-1");
    expect(error).toBeNull();
    expect(map).toEqual({});
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
