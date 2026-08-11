/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../crm/conversationMutations", () => ({
  performAgentReply: jest.fn(),
}));

jest.mock("../notifications/deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/crm/agent-reply";
import { performAgentReply } from "../crm/conversationMutations";
import { deliverNotificationQueueItemWithPush } from "../notifications/deliverNotificationsServer";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("POST /api/crm/agent-reply", () => {
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

  test("delivers notification immediately after enqueue on server", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", agent_id: "agent-1" }, error: null });
    const adminFrom = jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
    }));

    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "agent-1" } } }),
          },
        };
      }
      return { from: adminFrom };
    });

    performAgentReply.mockResolvedValue({
      data: { id: "msg-1", created_at: "2026-08-11T17:00:00.000Z" },
      error: null,
      queueId: "queue-1",
    });
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true, data: { ok: true } });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { conversationId: "conv-1", body: "Thanks for your interest" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(performAgentReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversationId: "conv-1",
        agentUserId: "agent-1",
        body: "Thanks for your interest",
      })
    );
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(expect.anything(), "queue-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejects non-owner agent", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: "conv-1", agent_id: "other-agent" }, error: null });
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "agent-1" } } }),
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
    expect(performAgentReply).not.toHaveBeenCalled();
  });
});
