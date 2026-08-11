/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../crm/viewingMutations", () => ({
  performDeclineViewing: jest.fn(),
}));

jest.mock("../notifications/deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/crm/viewing-decline";
import { performDeclineViewing } from "../crm/viewingMutations";
import { deliverNotificationQueueItemWithPush } from "../notifications/deliverNotificationsServer";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("POST /api/crm/viewing-decline", () => {
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

  test("delivers viewing_declined push immediately after successful persist", async () => {
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "owner-1" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "view-1",
                  agent_user_id: "owner-1",
                  status: "pending",
                },
                error: null,
              }),
            }),
          }),
        })),
      };
    });

    performDeclineViewing.mockResolvedValue({
      data: { id: "view-1", status: "declined" },
      error: null,
      queueId: "queue-declined-1",
    });
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true, data: { ok: true } });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { viewingId: "view-1" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(performDeclineViewing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        viewingId: "view-1",
        agentUserId: "owner-1",
      })
    );
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(
      expect.anything(),
      "queue-declined-1"
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("rejects decline when caller is not listing contact", async () => {
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "other-user" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "view-1",
                  agent_user_id: "owner-1",
                  status: "pending",
                },
                error: null,
              }),
            }),
          }),
        })),
      };
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { viewingId: "view-1" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(performDeclineViewing).not.toHaveBeenCalled();
    expect(deliverNotificationQueueItemWithPush).not.toHaveBeenCalled();
  });

  test("does not deliver when decline persistence fails", async () => {
    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "owner-1" } } }),
          },
        };
      }
      return {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: "view-1",
                  agent_user_id: "owner-1",
                  status: "pending",
                },
                error: null,
              }),
            }),
          }),
        })),
      };
    });

    performDeclineViewing.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "0 rows" },
      queueId: null,
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: { viewingId: "view-1" },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(deliverNotificationQueueItemWithPush).not.toHaveBeenCalled();
  });
});
