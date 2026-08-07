/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../profileSelectContract", () => ({
  fetchProfileRowWithTiers: jest.fn(),
  PROFILE_ROLE_ONLY_SELECT: "role",
}));

jest.mock("./sendWebPushToUser", () => ({
  sendWebPushToUser: jest.fn(),
}));

jest.mock("./pushTestRateLimit", () => ({
  checkPushTestRateLimit: jest.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  recordPushTestSent: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { fetchProfileRowWithTiers } from "../profileSelectContract";
import handler from "../../pages/api/push/test";
import { sendWebPushToUser } from "./sendWebPushToUser";
import {
  checkPushTestRateLimit,
  recordPushTestSent,
} from "./pushTestRateLimit";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockAuthenticatedClients(role = "admin") {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
  createClient
    .mockReturnValueOnce({ auth: { getUser } })
    .mockReturnValueOnce({ from: jest.fn(), rpc: jest.fn() });
  fetchProfileRowWithTiers.mockResolvedValue({ data: { role }, error: null });
}

describe("POST /api/push/test", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SITE_URL: "https://belizelistings.bz",
      WEB_PUSH_VAPID_PUBLIC_KEY: "public-key",
      WEB_PUSH_VAPID_PRIVATE_KEY: "private-key",
      WEB_PUSH_VAPID_SUBJECT: "mailto:ops@belizelistings.bz",
    };
    checkPushTestRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("rejects anonymous callers", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: { origin: "https://belizelistings.bz" }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("rejects caller-supplied recipient or arbitrary content", async () => {
    mockAuthenticatedClients("admin");
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: {
          origin: "https://belizelistings.bz",
          authorization: "Bearer token",
        },
        body: {
          userId: "other-user",
          title: "Custom title",
          body: "Custom body",
          href: "https://evil.example",
        },
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("rejects forbidden origin", async () => {
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: { origin: "https://evil.example", authorization: "Bearer token" },
        body: {},
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test.each(["user", "agent", "broker"])(
    "rejects authenticated non-admin role %s",
    async (role) => {
      mockAuthenticatedClients(role);
      const res = mockRes();
      await handler(
        {
          method: "POST",
          headers: {
            origin: "https://belizelistings.bz",
            authorization: "Bearer token",
          },
          body: {},
        },
        res
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "admin_required" });
      expect(sendWebPushToUser).not.toHaveBeenCalled();
    }
  );

  test("is rate limited for verified admins", async () => {
    checkPushTestRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 45000 });
    mockAuthenticatedClients("admin");

    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: {
          origin: "https://belizelistings.bz",
          authorization: "Bearer token",
        },
        body: {},
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(429);
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("sends fixed safe payload to authenticated admin subscriptions only", async () => {
    mockAuthenticatedClients("admin");

    sendWebPushToUser.mockResolvedValue({
      ok: true,
      attempted: 2,
      delivered: 2,
      temporaryFailures: 0,
      deactivated: 0,
    });

    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: {
          origin: "https://belizelistings.bz",
          authorization: "Bearer token",
        },
        body: {},
      },
      res
    );

    expect(sendWebPushToUser).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        ok: true,
        payload: expect.objectContaining({
          eventType: "push_test",
          title: "BelizeListings notifications are active",
          href: "/dashboard/user?tab=profile",
        }),
      })
    );
    expect(recordPushTestSent).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        ok: true,
        attempted: 2,
        delivered: 2,
      })
    );
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("private-key");
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/endpoint|p256dh|auth/i);
  });
});
