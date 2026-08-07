/** @jest-environment node */

jest.mock("./deliverNotificationsServer", () => ({
  triggerNotificationDeliveryWithPush: jest.fn().mockResolvedValue({ ok: true, data: { processed: 1 } }),
}));

import { triggerNotificationDeliveryWithPush } from "./deliverNotificationsServer";
import { triggerServerNotificationDelivery } from "./triggerServerNotificationDelivery";

describe("triggerServerNotificationDelivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("uses server push pipeline directly on the server", async () => {
    const client = { rpc: jest.fn() };
    const originalWindow = global.window;
    // @ts-expect-error test override
    delete global.window;

    await triggerServerNotificationDelivery(client, { limit: 3 });

    expect(triggerNotificationDeliveryWithPush).toHaveBeenCalledWith(client, { limit: 3 });
    expect(global.fetch).not.toHaveBeenCalled();

    global.window = originalWindow;
  });

  test("calls trigger-delivery API from the browser", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ ok: true, batch: { processed: 1 } }),
    });
    global.window = {};

    const client = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
      },
    };

    await triggerServerNotificationDelivery(client, { limit: 4 });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/notifications/trigger-delivery",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
        body: JSON.stringify({ limit: 4, queueId: null, inquiryId: null, conversationId: null }),
      })
    );
  });
});
