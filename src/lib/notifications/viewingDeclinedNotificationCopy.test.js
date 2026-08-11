/** @jest-environment node */

import {
  buildViewingDeclinedPushCopy,
  buildViewingDeclinedInAppCopy,
} from "./viewingNotificationCopy";
import { formatViewingSlotCompact } from "@/lib/crm/viewingConversationMessages";

describe("viewing_declined notification copy", () => {
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

  test("push copy includes listing and Belize slot phrase", () => {
    expect(
      buildViewingDeclinedPushCopy({
        listing_title: "Finca Solana",
        requested_date: "2026-07-15",
        requested_time: "10:00",
      })
    ).toEqual({
      title: "Viewing request declined",
      body: "Your viewing request for Finca Solana on Wednesday, July 15 at 10:00 AM was declined.",
    });
  });

  test("push copy falls back without listing title", () => {
    expect(
      buildViewingDeclinedPushCopy({
        requested_date: "2026-07-15",
        requested_time: "10:00",
      }).body
    ).toBe("Your viewing request for Wednesday, July 15 at 10:00 AM was declined.");
  });

  test.each([
    ["10:00", "10:00 AM"],
    ["14:30", "2:30 PM"],
    ["12:00", "12:00 PM"],
    ["00:00", "12:00 AM"],
  ])("Belize wall clock %s displays as %s on UTC server", (time, expected) => {
    const payload = {
      listing_title: "Finca Solana",
      requested_date: "2026-07-15",
      requested_time: time,
    };
    const pushCopy = buildViewingDeclinedPushCopy(payload);
    const uiCompact = formatViewingSlotCompact(payload.requested_date, payload.requested_time);

    expect(pushCopy.body).toContain(expected);
    expect(uiCompact).toContain(expected);
    expect(pushCopy.body).not.toContain("4:00 AM");
  });

  test("in-app copy matches push copy", () => {
    const payload = {
      listing_title: "Finca Solana",
      requested_date: "2026-07-15",
      requested_time: "10:00",
    };
    expect(buildViewingDeclinedInAppCopy(payload)).toEqual(buildViewingDeclinedPushCopy(payload));
  });
});
