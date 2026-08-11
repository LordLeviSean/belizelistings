/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

jest.mock("./sendWebPushToUser", () => ({
  sendWebPushToUser: jest.fn(),
}));

import { sendWebPushToUser } from "./sendWebPushToUser";
import { deliverNewInquiryWebPush } from "./deliverNewInquiryWebPush";
import { WEB_PUSH_DELIVERY_STATUS } from "./webPushDeliveryState";

function buildNotificationClient(initialPayload = {}) {
  let payload = { ...initialPayload };

  const from = jest.fn((table) => {
    if (table === "notifications") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(function eq(field) {
            if (field === "id") {
              return {
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: "notif-1", payload }, error: null }),
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { payload }, error: null }),
                })),
              };
            }
            return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
          }),
        })),
        update: jest.fn((patch) => {
          if (patch?.payload) payload = patch.payload;
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
            maybeSingle: jest.fn().mockResolvedValue({ data: { role: "user" }, error: null }),
          })),
        })),
      };
    }

    return {};
  });

  return { client: { from }, getPayload: () => payload };
}

describe("agent_replied push reliability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendWebPushToUser.mockResolvedValue({
      ok: true,
      attempted: 1,
      delivered: 1,
      temporaryFailures: 0,
      deactivated: 0,
    });
  });

  test("one agent_replied delivery sends to a single subscription target", async () => {
    const { client } = buildNotificationClient({
      conversation_id: "conv-1",
      message_id: "msg-1",
    });

    await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "agent_replied",
      recipient_id: "buyer-1",
      notification_id: "notif-1",
      dedupe_key: "agent_replied:msg-1:buyer-1",
    });

    expect(sendWebPushToUser).toHaveBeenCalledTimes(1);
    expect(sendWebPushToUser).toHaveBeenCalledWith(
      client,
      "buyer-1",
      expect.anything(),
      { maxSubscriptions: 1 }
    );
  });

  test("retry after delivered state does not send another push", async () => {
    const { client, getPayload } = buildNotificationClient();

    await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "agent_replied",
      recipient_id: "buyer-1",
      notification_id: "notif-1",
      dedupe_key: "agent_replied:msg-1:buyer-1",
    });

    expect(getPayload()._web_push?.status).toBe(WEB_PUSH_DELIVERY_STATUS.DELIVERED);
    sendWebPushToUser.mockClear();

    const retry = await deliverNewInquiryWebPush(client, {
      ok: true,
      event_type: "agent_replied",
      recipient_id: "buyer-1",
      notification_id: "notif-1",
      dedupe_key: "agent_replied:msg-1:buyer-1",
    });

    expect(retry.reason).toBe("already_delivered");
    expect(sendWebPushToUser).not.toHaveBeenCalled();
  });
});
