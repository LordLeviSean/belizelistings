/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../crm/conversationMutations", () => ({
  performBuyerReply: jest.fn(),
}));

jest.mock("../notifications/deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/crm/buyer-reply";
import { performBuyerReply } from "../crm/conversationMutations";
import { deliverNotificationQueueItemWithPush } from "../notifications/deliverNotificationsServer";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("POST /api/crm/buyer-reply", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_BL_ENABLE_NOTIFICATIONS: "true",
    };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test("delivers buyer_replied notification immediately after enqueue on server", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", buyer_id: "buyer-1" }, error: null });
    const adminFrom = jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
    }));

    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return { from: adminFrom };
    });

    performBuyerReply.mockResolvedValue({
      data: { id: "msg-1", created_at: "2026-08-11T17:00:00.000Z" },
      error: null,
      queueId: "queue-buyer-1",
    });
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true, data: { ok: true } });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { conversationId: "conv-1", body: "Follow up question" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(performBuyerReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: "conv-1",
        buyerUserId: "buyer-1",
        body: "Follow up question",
      })
    );
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(
      expect.anything(),
      "queue-buyer-1"
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("does not deliver when mutation returns no queue id", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", buyer_id: "buyer-1" }, error: null });
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ maybeSingle }),
          }),
        })),
      };
    });

    performBuyerReply.mockResolvedValue({
      data: { id: "msg-1" },
      error: null,
      queueId: null,
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { conversationId: "conv-1", body: "Hello" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(deliverNotificationQueueItemWithPush).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("delivery failure still returns persisted message for cron recovery", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", buyer_id: "buyer-1" }, error: null });
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ maybeSingle }),
          }),
        })),
      };
    });

    performBuyerReply.mockResolvedValue({
      data: { id: "msg-1" },
      error: null,
      queueId: "queue-buyer-1",
    });
    deliverNotificationQueueItemWithPush.mockRejectedValue(new Error("push unavailable"));

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { conversationId: "conv-1", body: "Hello" },
    };
    const res = mockRes();

    await expect(handler(req, res)).rejects.toThrow("push unavailable");
    expect(performBuyerReply).toHaveBeenCalled();
  });

  test("rejects non-participant buyer", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", buyer_id: "other-buyer" }, error: null });
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ maybeSingle }),
          }),
        })),
      };
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { conversationId: "conv-1", body: "Nope" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(performBuyerReply).not.toHaveBeenCalled();
  });
});
