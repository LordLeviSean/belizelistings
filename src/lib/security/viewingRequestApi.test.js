/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../crm/viewingMutations", () => ({
  performCreateViewingRequest: jest.fn(),
}));

jest.mock("../notifications/deliverNotificationsServer", () => ({
  deliverNotificationQueueItemWithPush: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/crm/viewing-request";
import { performCreateViewingRequest } from "../crm/viewingMutations";
import { deliverNotificationQueueItemWithPush } from "../notifications/deliverNotificationsServer";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("POST /api/crm/viewing-request", () => {
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

  test("delivers viewing_requested push immediately after successful persist", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 12,
        user_id: "agent-1",
        title: "Finca Solana",
        status: "published",
        lifecycle_status: "published",
        moderation_status: "approved",
      },
      error: null,
    });

    createClient.mockImplementation((url, key) => {
      if (key === "anon-key") {
        return {
          auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: "buyer-1", email: "buyer@test.com" } } }),
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

    performCreateViewingRequest.mockResolvedValue({
      data: { id: "view-1", created_at: "2026-08-11T17:00:00.000Z" },
      error: null,
      queueId: "queue-view-1",
    });
    deliverNotificationQueueItemWithPush.mockResolvedValue({ ok: true, data: { ok: true } });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: {
        listingId: 12,
        requestedDate: "2026-07-15",
        requestedTime: "08:00",
        requesterName: "Alexis Marie",
      },
    };
    const res = mockRes();

    await handler(req, res);

    expect(performCreateViewingRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        listingId: 12,
        agentUserId: "agent-1",
        requesterId: "buyer-1",
        requestedDate: "2026-07-15",
        requestedTime: "08:00",
      })
    );
    expect(deliverNotificationQueueItemWithPush).toHaveBeenCalledWith(expect.anything(), "queue-view-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("blocks self-viewing before persist", async () => {
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
                  id: 12,
                  user_id: "owner-1",
                  status: "published",
                  lifecycle_status: "published",
                  moderation_status: "approved",
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
      body: {
        listingId: 12,
        requestedDate: "2026-07-15",
        requestedTime: "08:00",
      },
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(performCreateViewingRequest).not.toHaveBeenCalled();
  });
});
