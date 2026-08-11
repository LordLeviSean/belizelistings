/** @jest-environment jsdom */

jest.mock("../notifications/triggerServerNotificationDelivery", () => ({
  triggerServerNotificationDelivery: jest.fn(),
}));

jest.mock("../security/submitViewingConfirmViaApi", () => ({
  submitViewingConfirmViaApi: jest.fn(),
}));

import { confirmViewing } from "./viewingMutations";
import { submitViewingConfirmViaApi } from "../security/submitViewingConfirmViaApi";
import { triggerServerNotificationDelivery } from "../notifications/triggerServerNotificationDelivery";

describe("confirmViewing browser routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("browser confirm uses server API instead of client-side delivery trigger", async () => {
    submitViewingConfirmViaApi.mockResolvedValue({
      data: { id: "view-1", status: "confirmed" },
      error: null,
      queueId: "queue-confirmed-1",
    });

    const result = await confirmViewing(
      { from: jest.fn() },
      { viewingId: "view-1", agentUserId: "owner-1" }
    );

    expect(submitViewingConfirmViaApi).toHaveBeenCalledWith(
      { from: expect.anything() },
      { viewingId: "view-1", agentUserId: "owner-1", notes: undefined }
    );
    expect(triggerServerNotificationDelivery).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.queueId).toBe("queue-confirmed-1");
  });
});
