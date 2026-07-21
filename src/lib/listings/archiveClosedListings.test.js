/** @jest-environment node */

import { archiveExpiredClosedListings } from "./archiveClosedListings";

describe("archiveExpiredClosedListings", () => {
  test("calls archive_expired_closed_listings RPC", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: { archived: 2, skipped: 0 }, error: null }),
    };
    const result = await archiveExpiredClosedListings(client);
    expect(client.rpc).toHaveBeenCalledWith("archive_expired_closed_listings");
    expect(result.ok).toBe(true);
    expect(result.data.archived).toBe(2);
  });

  test("surfaces RPC errors", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }),
    };
    const result = await archiveExpiredClosedListings(client);
    expect(result.ok).toBe(false);
  });
});
