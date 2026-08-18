/** @jest-environment node */

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

jest.mock("../push/pushApiAuth", () => ({
  readBearerToken: jest.fn(),
  loadVerifiedAdminProfile: jest.fn(),
}));

jest.mock("../profileSelectContract", () => ({
  fetchProfileRowWithTiers: jest.fn(),
  PROFILE_OWNER_MINIMAL_SELECT: "id, username, email, role",
}));

import { createClient } from "@supabase/supabase-js";
import handler from "../../pages/api/admin/notification-diagnostics";
import { readBearerToken, loadVerifiedAdminProfile } from "../push/pushApiAuth";
import { fetchProfileRowWithTiers } from "../profileSelectContract";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("GET /api/admin/notification-diagnostics", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...origEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };
    readBearerToken.mockReturnValue("token-1");
    loadVerifiedAdminProfile.mockResolvedValue({ role: "admin", username: "admin_user" });
    fetchProfileRowWithTiers.mockResolvedValue({
      data: { id: "agent-1", username: "coastal_realty", role: "agent" },
    });
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test("denies unauthorized requests", async () => {
    createClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = { method: "GET", headers: { authorization: "Bearer token-1" }, query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("denies non-admin users", async () => {
    createClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    loadVerifiedAdminProfile.mockResolvedValue(null);

    const req = { method: "GET", headers: { authorization: "Bearer token-1" }, query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns correlated diagnostic rows for admin", async () => {
    const queueSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({
        data: [
          {
            id: "queue-1",
            event_type: "buyer_replied",
            recipient_id: "agent-1",
            status: "sent",
            attempts: 1,
            created_at: "2026-08-18T10:00:00.000Z",
            processed_at: "2026-08-18T10:00:01.000Z",
            payload: { conversation_id: "conv-1", message_id: "msg-1" },
          },
        ],
        error: null,
        count: 1,
      }),
    });

    const notificationsIn = jest.fn().mockResolvedValue({
      data: [
        {
          id: "notif-1",
          queue_id: "queue-1",
          recipient_user_id: "agent-1",
          event_type: "buyer_replied",
          title: "Buyer replied",
          body: "Buyer replied",
          dedupe_key: "buyer_replied:msg-1:agent-1",
          created_at: "2026-08-18T10:00:01.100Z",
          payload: {
            conversation_id: "conv-1",
            _web_push: { status: "delivered", delivered_at: "2026-08-18T10:00:01.400Z" },
          },
        },
      ],
      error: null,
    });

    const subscriptionsIn = jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    createClient.mockImplementation((url, key, opts) => {
      if (opts?.global?.headers?.Authorization) {
        return {
          auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
        };
      }
      return {
        from: jest.fn((table) => {
          if (table === "notification_queue") {
            return { select: queueSelect };
          }
          if (table === "notifications") {
            return { select: jest.fn().mockReturnValue({ in: notificationsIn }) };
          }
          if (table === "push_subscriptions") {
            return { select: jest.fn().mockReturnValue({ in: subscriptionsIn }) };
          }
          return {};
        }),
      };
    });

    const req = { method: "GET", headers: { authorization: "Bearer token-1" }, query: { limit: "50" } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.ok).toBe(true);
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0].queueId).toBe("queue-1");
    expect(payload.rows[0].notificationId).toBe("notif-1");
    expect(payload.rows[0].navigation.href).toContain("conversation=conv-1");
  });
});
