/** @jest-environment node */

import { archiveExpiredClosedListings } from "./archiveClosedListings";

describe("archiveExpiredClosedListings", () => {
  test("calls archive_expired_closed_listings RPC with configured minutes", async () => {
    const client = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({
        data: { eligible: 2, archived: 2, notificationsQueued: 2, skipped: 0 },
        error: null,
      }),
    };
    const result = await archiveExpiredClosedListings(client, { archiveAfterMinutes: 2880 });
    expect(client.rpc).toHaveBeenCalledWith("archive_expired_closed_listings", {
      p_archive_after_minutes: 2880,
    });
    expect(result.ok).toBe(true);
    expect(result.data.archived).toBe(2);
    expect(result.data.eligible).toBe(2);
    expect(result.data.notificationsQueued).toBe(2);
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

  test("requires service-role rpc client", async () => {
    const result = await archiveExpiredClosedListings(null);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/unavailable/i);
  });

  test("idempotent repeated execution returns zero newly archived rows", async () => {
    const client = {
      from: jest.fn(() => ({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })),
      rpc: jest.fn().mockResolvedValue({
        data: { eligible: 0, archived: 0, notificationsQueued: 0 },
        error: null,
      }),
    };
    const first = await archiveExpiredClosedListings(client, { archiveAfterMinutes: 2880 });
    const second = await archiveExpiredClosedListings(client, { archiveAfterMinutes: 2880 });
    expect(first.data.archived).toBe(0);
    expect(second.data.archived).toBe(0);
    expect(second.data.notificationsQueued).toBe(0);
  });
});
