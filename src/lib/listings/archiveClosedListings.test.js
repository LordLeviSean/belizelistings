/** @jest-environment node */

import { archiveExpiredClosedListings } from "./archiveClosedListings";

describe("archiveExpiredClosedListings", () => {
  test("calls archive_expired_closed_listings RPC with configured minutes", async () => {
    const client = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({ data: { archived: 2, skipped: 0 }, error: null }),
    };
    const result = await archiveExpiredClosedListings(client, { archiveAfterMinutes: 2880 });
    expect(client.rpc).toHaveBeenCalledWith("archive_expired_closed_listings", {
      p_archive_after_minutes: 2880,
    });
    expect(result.ok).toBe(true);
    expect(result.data.archived).toBe(2);
  });

  test("surfaces RPC errors", async () => {
    const client = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }),
    };
    const result = await archiveExpiredClosedListings(client, { archiveAfterMinutes: 1 });
    expect(result.ok).toBe(false);
  });
});
