/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("./sendWebPushToUser", () => ({
  sendWebPushToUser: jest.fn(),
}));

import { sendWebPushToUser } from "./sendWebPushToUser";
import {
  deliverNewInquiryWebPush,
  reconcileUndeliveredNewInquiryPushes,
} from "./deliverNewInquiryWebPush";
import { WEB_PUSH_DELIVERY_STATUS } from "./webPushDeliveryState";

function buildStatefulNotificationClient(initialPayload = {}) {
  let payload = { conversation_id: "conv-1", ...initialPayload };

  const reconciliationRows = [
    {
      id: "notif-1",
      recipient_user_id: "agent-1",
      event_type: "new_inquiry",
      dedupe_key: "new_inquiry:inq-1",
      get payload() {
        return payload;
      },
      created_at: new Date().toISOString(),
    },
  ];

  const reconciliationQuery = {
    gte: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue({
          data: reconciliationRows,
          error: null,
        }),
      })),
    })),
  };

  const notificationSelectChain = {
    in: jest.fn(() => reconciliationQuery),
    eq: jest.fn(function eq(field, value) {
      if (field === "event_type") {
        return reconciliationQuery;
      }

      if (field === "id") {
        return {
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "notif-1", payload },
            error: null,
          }),
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { payload },
              error: null,
            }),
          })),
        };
      }

      return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  };

  const from = jest.fn((table) => {
    if (table === "notifications") {
      return {
        select: jest.fn(() => notificationSelectChain),
        update: jest.fn((patch) => {
          if (patch?.payload) {
            payload = patch.payload;
          }
          return {
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
              })),
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
            })),
          };
        }),
      };
    }

    if (table === "profiles") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: "agent" }, error: null }),
          })),
        })),
      };
    }

    return {};
  });

  return {
    client: { from, rpc: jest.fn() },
    getPayload: () => payload,
  };
}

describe("new inquiry delivery synchronization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendWebPushToUser.mockReset();
  });

  test("immediate success prevents reconciliation duplication", async () => {
    sendWebPushToUser.mockResolvedValue({
      ok: true,
      attempted: 1,
      delivered: 1,
      temporaryFailures: 0,
      deactivated: 0,
    });

    const { client, getPayload } = buildStatefulNotificationClient();

    await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(sendWebPushToUser).toHaveBeenCalledTimes(1);
    expect(getPayload()._web_push?.status).toBe(WEB_PUSH_DELIVERY_STATUS.DELIVERED);

    sendWebPushToUser.mockClear();
    const reconcile = await reconcileUndeliveredNewInquiryPushes(client, { hours: 2, limit: 5 });
    expect(reconcile.attempted).toBe(0);
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("temporary failure remains retryable through reconciliation", async () => {
    sendWebPushToUser
      .mockResolvedValueOnce({
        ok: false,
        attempted: 1,
        delivered: 0,
        temporaryFailures: 1,
        deactivated: 0,
        error: "provider_unavailable",
      })
      .mockResolvedValueOnce({
        ok: true,
        attempted: 1,
        delivered: 1,
        temporaryFailures: 0,
        deactivated: 0,
      });

    const { client, getPayload } = buildStatefulNotificationClient();

    await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(getPayload()._web_push?.status).toBe(WEB_PUSH_DELIVERY_STATUS.TEMPORARY_FAILURE);

    const reconcile = await reconcileUndeliveredNewInquiryPushes(client, { hours: 2, limit: 5 });
    expect(reconcile.attempted).toBe(1);
    expect(getPayload()._web_push?.status).toBe(WEB_PUSH_DELIVERY_STATUS.DELIVERED);
  });

  test("no active subscription is terminal and skipped by reconciliation", async () => {
    sendWebPushToUser.mockResolvedValue({
      ok: false,
      error: "no_active_subscriptions",
      attempted: 0,
      delivered: 0,
      temporaryFailures: 0,
      deactivated: 0,
    });

    const { client, getPayload } = buildStatefulNotificationClient();

    await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "new_inquiry",
      recipient_id: "agent-1",
      notification_id: "notif-1",
      dedupe_key: "new_inquiry:inq-1",
    });

    expect(getPayload()._web_push?.status).toBe(WEB_PUSH_DELIVERY_STATUS.NO_SUBSCRIPTION);

    sendWebPushToUser.mockClear();
    const reconcile = await reconcileUndeliveredNewInquiryPushes(client, { hours: 2, limit: 5 });
    expect(reconcile.attempted).toBe(0);
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });
});
