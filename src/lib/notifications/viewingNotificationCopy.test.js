/** @jest-environment node */

import { buildViewingRequestedPushCopy, buildViewingRequestedInAppCopy } from "./viewingNotificationCopy";

describe("viewingNotificationCopy", () => {
  test("push copy personalizes buyer name and slot", () => {
    expect(
      buildViewingRequestedPushCopy({
        sender_name: "Alexis Marie",
        listing_title: "Finca Solana",
        requested_date: "2026-07-15",
        requested_time: "08:00",
      })
    ).toEqual({
      title: "New viewing request",
      body: "Alexis Marie requested a viewing of Finca Solana for Wednesday, July 15 at 8:00 AM.",
    });
  });

  test("push copy falls back without buyer name", () => {
    expect(
      buildViewingRequestedPushCopy({
        requested_date: "2026-07-15",
        requested_time: "08:00",
      }).body
    ).toBe("A buyer requested a viewing for Wednesday, July 15 at 8:00 AM.");
  });

  test("in-app copy includes listing and slot phrase", () => {
    const copy = buildViewingRequestedInAppCopy({
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      requested_date: "2026-07-15",
      requested_time: "08:00",
    });
    expect(copy.title).toBe("New viewing request");
    expect(copy.body).toContain("Alexis Marie");
    expect(copy.body).toContain("Finca Solana");
    expect(copy.body).toContain("8:00 AM");
  });
});
