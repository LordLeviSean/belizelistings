/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../notifications/deliverNotifications", () => ({
  processNotificationQueueBatch: jest.fn().mockResolvedValue({ ok: true, data: { processed: 1 } }),
}));

jest.mock("./archiveClosedListings", () => ({
  archiveExpiredClosedListings: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/cron/archive-closed-listings";
import { archiveExpiredClosedListings } from "./archiveClosedListings";
import { processNotificationQueueBatch } from "../notifications/deliverNotifications";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("GET/POST /api/cron/archive-closed-listings", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };
    createClient.mockReturnValue({});
    archiveExpiredClosedListings.mockResolvedValue({
      ok: true,
      data: { eligible: 2, archived: 1, notificationsQueued: 1 },
    });
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test("returns 503 when CRON_SECRET missing (fail closed)", async () => {
    delete process.env.CRON_SECRET;
    const req = { method: "GET", headers: {}, query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(archiveExpiredClosedListings).not.toHaveBeenCalled();
  });

  test("returns 401 when CRON_SECRET invalid", async () => {
    process.env.CRON_SECRET = "expected";
    const req = { method: "POST", headers: {}, query: { secret: "wrong" }, body: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(archiveExpiredClosedListings).not.toHaveBeenCalled();
  });

  test("uses service-role client and returns structured operational response", async () => {
    process.env.CRON_SECRET = "expected";
    const req = {
      method: "POST",
      headers: { authorization: "Bearer expected" },
      query: {},
      body: { limit: 10 },
    };
    const res = mockRes();

    await handler(req, res);

    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-key");
    expect(archiveExpiredClosedListings).toHaveBeenCalled();
    expect(processNotificationQueueBatch).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        eligible: 2,
        archived: 1,
        notificationsQueued: 1,
      })
    );
  });

  test("returns 500 when archive RPC fails", async () => {
    process.env.CRON_SECRET = "expected";
    archiveExpiredClosedListings.mockResolvedValueOnce({
      ok: false,
      error: { message: "forbidden" },
      data: null,
    });
    const req = {
      method: "GET",
      headers: { "x-cron-secret": "expected" },
      query: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(processNotificationQueueBatch).not.toHaveBeenCalled();
  });
});
