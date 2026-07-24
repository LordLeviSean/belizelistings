/** @jest-environment node */

import { fetchNotifications } from "./fetchNotifications";
import { buildNotificationDropdownRetentionCutoffIso } from "./notificationCenterQuery";

jest.mock("../featureFlags", () => ({
  BL_ENABLE_NOTIFICATIONS: true,
}));

describe("fetchNotifications ordering and retention", () => {
  function buildClient({ rows = [], capture = {} } = {}) {
    const range = jest.fn().mockResolvedValue({ data: rows, error: null });
    const secondOrder = jest.fn().mockReturnValue({ range });
    const firstOrder = jest.fn().mockReturnValue({ order: secondOrder, range });
    const or = jest.fn().mockReturnValue({ order: firstOrder });
    const eq = jest.fn().mockReturnValue({ or, order: firstOrder, is: jest.fn().mockReturnValue({ order: firstOrder }) });
    const select = jest.fn().mockReturnValue({ eq });
    capture.eq = eq;
    capture.or = or;
    capture.firstOrder = firstOrder;
    capture.secondOrder = secondOrder;
    return { from: jest.fn().mockReturnValue({ select }) };
  }

  test("orders by created_at desc then id desc", async () => {
    const capture = {};
    const client = buildClient({ capture });
    await fetchNotifications(client, "user-1", { limit: 12 });
    expect(capture.firstOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(capture.secondOrder).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("dropdown retention keeps unread and recently read rows", async () => {
    const capture = {};
    const client = buildClient({ capture });
    const cutoff = buildNotificationDropdownRetentionCutoffIso(Date.parse("2026-07-24T12:00:00.000Z"));
    await fetchNotifications(client, "user-1", {
      limit: 12,
      dropdownRetentionHours: 24,
      nowMs: Date.parse("2026-07-24T12:00:00.000Z"),
    });
    expect(capture.or).toHaveBeenCalledWith(`read_at.is.null,read_at.gte.${cutoff}`);
  });
});
