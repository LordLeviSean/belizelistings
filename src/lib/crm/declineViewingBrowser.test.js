/** @jest-environment jsdom */

jest.mock("../notifications/triggerServerNotificationDelivery", () => ({
  triggerServerNotificationDelivery: jest.fn(),
}));

jest.mock("../security/submitViewingDeclineViaApi", () => ({
  submitViewingDeclineViaApi: jest.fn(),
}));

import { declineViewing } from "./viewingMutations";
import { submitViewingDeclineViaApi } from "../security/submitViewingDeclineViaApi";
import { triggerServerNotificationDelivery } from "../notifications/triggerServerNotificationDelivery";

describe("declineViewing browser routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("browser decline uses server API instead of client-side delivery trigger", async () => {
    submitViewingDeclineViaApi.mockResolvedValue({
      data: { id: "view-1", status: "declined" },
      error: null,
      queueId: "queue-declined-1",
    });

    const result = await declineViewing(
      { from: jest.fn() },
      { viewingId: "view-1", agentUserId: "owner-1" }
    );

    expect(submitViewingDeclineViaApi).toHaveBeenCalledWith(
      { from: expect.anything() },
      { viewingId: "view-1", agentUserId: "owner-1", notes: undefined }
    );
    expect(triggerServerNotificationDelivery).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
    expect(result.queueId).toBe("queue-declined-1");
  });
});
