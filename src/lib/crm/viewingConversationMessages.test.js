/** @jest-environment node */

import {
  VIEWING_SYSTEM_MESSAGE,
  formatViewingSlotCompact,
  formatViewingSlotLabel,
  formatViewingSlotPushPhrase,
  parseBelizeViewingInstant,
} from "./viewingConversationMessages";
import { buildViewingRequestedPushCopy } from "../notifications/viewingNotificationCopy";

describe("viewingConversationMessages Belize timezone", () => {
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

  test.each([
    ["10:00", "10:00 AM"],
    ["14:30", "2:30 PM"],
    ["12:00", "12:00 PM"],
    ["00:00", "12:00 AM"],
  ])("formatViewingSlotLabel preserves %s as %s on UTC server", (time, expected) => {
    const label = formatViewingSlotLabel("2026-07-15", time);
    expect(label).toContain("July 15");
    expect(label).toContain(expected);
    expect(label).not.toContain("4:00 AM");
  });

  test("formatViewingSlotPushPhrase matches label with at separator", () => {
    expect(formatViewingSlotPushPhrase("2026-07-15", "10:00")).toBe(
      "Wednesday, July 15 at 10:00 AM"
    );
  });

  test("formatViewingSlotCompact matches push phrase time on UTC server", () => {
    const compact = formatViewingSlotCompact("2026-07-15", "10:00");
    const pushPhrase = formatViewingSlotPushPhrase("2026-07-15", "10:00");
    expect(compact).toContain("10:00 AM");
    expect(pushPhrase).toContain("10:00 AM");
    expect(compact).toContain("Wed");
  });

  test("parseBelizeViewingInstant does not shift 10:00 wall clock by six hours", () => {
    const instant = parseBelizeViewingInstant("2026-07-15", "10:00");
    expect(instant).not.toBeNull();
    expect(
      instant.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Belize",
      })
    ).toBe("10:00 AM");
  });

  test("late-night Belize appointment does not roll date backward", () => {
    const label = formatViewingSlotLabel("2026-07-15", "23:30");
    expect(label).toContain("July 15");
    expect(label).toContain("11:30 PM");
  });

  test("viewing_requested push copy uses the same Belize slot as UI formatters", () => {
    const payload = {
      sender_name: "Alexis Marie",
      listing_title: "Finca Solana",
      requested_date: "2026-07-15",
      requested_time: "10:00",
    };
    const pushCopy = buildViewingRequestedPushCopy(payload);
    const uiPhrase = formatViewingSlotPushPhrase(payload.requested_date, payload.requested_time);

    expect(pushCopy.body).toContain("10:00 AM");
    expect(pushCopy.body).toContain(uiPhrase);
    expect(pushCopy.body).not.toContain("4:00 AM");
  });

  test("canonical confirm copy includes slot", () => {
    expect(VIEWING_SYSTEM_MESSAGE.CONFIRMED("July 3")).toContain("confirmed");
    expect(VIEWING_SYSTEM_MESSAGE.CONFIRMED("July 3")).toContain("July 3");
  });

  test("decline and reschedule copy are stable", () => {
    expect(VIEWING_SYSTEM_MESSAGE.DECLINED).toContain("declined");
    expect(VIEWING_SYSTEM_MESSAGE.RESCHEDULE_PROPOSED("July 4")).toContain("proposed");
    expect(VIEWING_SYSTEM_MESSAGE.RESCHEDULE_ACCEPTED("July 4")).toContain("accepted");
  });
});
