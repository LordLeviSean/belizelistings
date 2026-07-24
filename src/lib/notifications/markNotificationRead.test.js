/** @jest-environment node */

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

import { markNotificationRead } from "./markNotificationRead";

describe("markNotificationRead", () => {
  test("marks unread notification read without overwriting existing read_at", async () => {
    const is = jest.fn().mockResolvedValue({ error: null });
    const eqRecipient = jest.fn().mockReturnValue({ is });
    const eqId = jest.fn().mockReturnValue({ eq: eqRecipient });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    const client = { from: jest.fn().mockReturnValue({ update }) };

    const result = await markNotificationRead(client, {
      notificationId: "n-1",
      userId: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(is).toHaveBeenCalledWith("read_at", null);
  });
});
