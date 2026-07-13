/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_INQUIRIES: true,
  BL_ENABLE_CONVERSATIONS: true,
  BL_ENABLE_VIEWING_PERSIST: true,
}));

import { loadBuyerCrmData } from "./buyerCrmData";

describe("loadBuyerCrmData", () => {
  test("batch-fetches listings for inquiries and viewings in one query", async () => {
    const inSpy = jest.fn().mockResolvedValue({
      data: [
        {
          id: 42,
          title: "Seafront Villa",
          district: "placencia",
          status: "approved",
          listing_images: [{ image_url: "https://img/1.jpg", position: 0 }],
        },
      ],
      error: null,
    });

    const client = {
      from: jest.fn((table) => {
        if (table === "listing_inquiries") {
          return {
            select: jest.fn().mockReturnValue({
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: "inq-1", listing_id: 42 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      is: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "viewing_requests") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      is: jest.fn().mockResolvedValue({
                        data: [{ id: "vr-1", listing_id: 42 }],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "listings") {
          return { select: jest.fn().mockReturnValue({ in: inSpy }) };
        }
        return {};
      }),
    };

    const result = await loadBuyerCrmData(client, "buyer-1");

    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith("id", [42]);
    expect(result.listingsById[42]?.title).toBe("Seafront Villa");
    expect(result.viewings).toHaveLength(1);
    expect(result.inquiries).toHaveLength(1);
  });

  test("returns empty map when no listing ids", async () => {
    const client = {
      from: jest.fn((table) => {
        if (table === "listing_inquiries") {
          return {
            select: jest.fn().mockReturnValue({
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "conversations") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      is: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "viewing_requests") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      is: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: jest.fn() };
      }),
    };

    const result = await loadBuyerCrmData(client, "buyer-1");
    expect(result.listingsById).toEqual({});
  });
});
