/** @jest-environment node */

import { buildPushTestPayload, resolvePushTestDestination } from "./pushTestPayload";

describe("pushTestPayload", () => {
  test("uses fixed safe presentation and destination by role", () => {
    expect(resolvePushTestDestination("agent")).toBe("/dashboard/agent?tab=profile");
    expect(resolvePushTestDestination("broker")).toBe("/dashboard/broker");
    expect(resolvePushTestDestination("user")).toBe("/dashboard/user?tab=profile");

    const built = buildPushTestPayload({ userId: "11111111-1111-1111-1111-111111111111", role: "user" });
    expect(built.ok).toBe(true);
    expect(built.payload).toEqual(
      expect.objectContaining({
        eventType: "push_test",
        title: "BelizeListings notifications are active",
        body: "This device can now receive important BelizeListings updates.",
        href: "/dashboard/user?tab=profile",
        tag: "push_test",
      })
    );
  });
});
