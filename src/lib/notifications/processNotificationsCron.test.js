/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("./deliverNotifications", () => ({
  processNotificationQueueBatch: jest.fn().mockResolvedValue({ ok: true, data: { processed: 0 } }),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/cron/process-notifications";
import { processNotificationQueueBatch } from "./deliverNotifications";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("GET/POST /api/cron/process-notifications", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };
    createClient.mockReturnValue({});
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
    expect(processNotificationQueueBatch).not.toHaveBeenCalled();
  });

  test("returns 401 when secret invalid", async () => {
    process.env.CRON_SECRET = "expected";
    const req = { method: "POST", headers: {}, query: { secret: "wrong" }, body: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(processNotificationQueueBatch).not.toHaveBeenCalled();
  });

  test("processes batch when secret valid", async () => {
    process.env.CRON_SECRET = "expected";
    const req = {
      method: "POST",
      headers: { authorization: "Bearer expected" },
      query: {},
      body: { limit: 10 },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(processNotificationQueueBatch).toHaveBeenCalled();
  });
});
