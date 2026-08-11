/** @jest-environment node */

import { buildViewingRequestedPushCopy, buildViewingRequestedInAppCopy } from "./viewingNotificationCopy";
import { formatViewingSlotCompact } from "@/lib/crm/viewingConversationMessages";

describe("viewingNotificationCopy", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

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

  test.each([
    ["10:00", "10:00 AM"],
    ["14:30", "2:30 PM"],
    ["12:00", "12:00 PM"],
    ["00:00", "12:00 AM"],
  ])("10:00 AM Belize regression: %s displays as %s on UTC server", (time, expected) => {
    const payload = {
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      requested_date: "2026-07-15",
      requested_time: time,
    };
    const pushCopy = buildViewingRequestedPushCopy(payload);
    const uiCompact = formatViewingSlotCompact(payload.requested_date, payload.requested_time);

    expect(pushCopy.body).toContain(expected);
    expect(uiCompact).toContain(expected);
    expect(pushCopy.body).not.toContain("4:00 AM");
  });
});
