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

jest.mock("../notifications/deliverNewInquiryForInquiry", () => ({
  deliverNewInquiryNotificationForInquiry: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock("../notifications/deliverBuyerRepliedForMessage", () => ({
  deliverBuyerRepliedNotificationForMessage: jest.fn().mockResolvedValue({ ok: true }),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/inquiries/create";
import { verifyTurnstileToken } from "./verifyTurnstile";
import { deliverNewInquiryNotificationForInquiry } from "../notifications/deliverNewInquiryForInquiry";
import { deliverBuyerRepliedNotificationForMessage } from "../notifications/deliverBuyerRepliedForMessage";

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
      NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS: "true",
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

  test("rejects unauthenticated inquiries", async () => {
    createClient.mockReturnValue({
      from: jest.fn(),
      rpc: jest.fn(),
      auth: { getUser: jest.fn() },
    });

    const req = {
      method: "POST",
      headers: {},
      body: { listingId: 1, message: "Hello" },
      socket: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "authentication_required" })
    );
  });

  test("maps RPC rate_limited_listing to HTTP 429", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "rate_limited_listing: maximum guest inquiries per listing per hour exceeded" },
    });
    createClient.mockImplementation((url, key, opts) => {
      const isUserClient = opts?.global?.headers?.Authorization;
      if (isUserClient) {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return {
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
      };
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: {
        listingId: 1,
        message: "Hello again",
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

  function buildAuthenticatedCreateClient(rpcResult) {
    const rpc = jest.fn().mockResolvedValue({ data: rpcResult, error: null });
    createClient.mockImplementation((url, key, opts) => {
      const isUserClient = opts?.global?.headers?.Authorization;
      if (isUserClient) {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return {
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
      };
    });
    return rpc;
  }

  test("new conversation delivers new_inquiry notification", async () => {
    buildAuthenticatedCreateClient({
      inquiry_id: "inq-new",
      conversation_id: "conv-new",
      message_id: "msg-new",
      reused_conversation: false,
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { listingId: 1, message: "First contact" },
      socket: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(deliverNewInquiryNotificationForInquiry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ inquiryId: "inq-new", conversationId: "conv-new" })
    );
    expect(deliverBuyerRepliedNotificationForMessage).not.toHaveBeenCalled();
  });

  test("reused conversation delivers buyer_replied by message id", async () => {
    buildAuthenticatedCreateClient({
      inquiry_id: "inq-existing",
      conversation_id: "conv-existing",
      message_id: "msg-followup",
      reused_conversation: true,
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
      body: { listingId: 1, message: "Follow up from listing page" },
      socket: {},
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(deliverBuyerRepliedNotificationForMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageId: "msg-followup" })
    );
    expect(deliverNewInquiryNotificationForInquiry).not.toHaveBeenCalled();
  });
});
