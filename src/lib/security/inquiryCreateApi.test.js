/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("./verifyTurnstile", () => ({
  verifyTurnstileToken: jest.fn(),
}));

jest.mock("./logSecurityEvent", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../listingEvents/writeListingEvent", () => ({
  emitListingEventAfterMutation: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../notifications/notificationEvents", () => ({
  triggerNotificationDelivery: jest.fn().mockResolvedValue({ ok: true }),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/inquiries/create";
import { verifyTurnstileToken } from "./verifyTurnstile";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("POST /api/inquiries/create", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_BL_ENABLE_TURNSTILE: "true",
      TURNSTILE_SECRET_KEY: "secret",
    };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test("rejects honeypot field", async () => {
    const rpc = jest.fn();
    createClient.mockReturnValue({ from: jest.fn(), rpc });

    const req = {
      method: "POST",
      headers: {},
      body: { listingId: 1, senderEmail: "bot@test.com", message: "hi", company_website: "http://spam.com" },
      socket: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "spam_detected" })
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  test("rejects guest when turnstile verification fails", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: false, error: "turnstile_verification_failed" });
    createClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      }),
      rpc: jest.fn(),
      auth: { getUser: jest.fn() },
    });

    const req = {
      method: "POST",
      headers: {},
      body: {
        listingId: 1,
        senderEmail: "guest@test.com",
        message: "Hello",
        turnstileToken: "bad",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(verifyTurnstileToken).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "captcha_failed" })
    );
  });

  test("maps RPC rate_limited_listing to HTTP 429", async () => {
    verifyTurnstileToken.mockResolvedValue({ ok: true });
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "rate_limited_listing: maximum guest inquiries per listing per hour exceeded" },
    });
    createClient.mockImplementation(() => ({
      from: jest.fn((table) => {
        if (table === "listings") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 1, user_id: "agent-1", status: "published" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }),
      rpc,
    }));

    const req = {
      method: "POST",
      headers: {},
      body: {
        listingId: 1,
        senderEmail: "guest@test.com",
        message: "Hello again",
        turnstileToken: "ok",
      },
      socket: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "rate_limited_listing" })
    );
  });
});
