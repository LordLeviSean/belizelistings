/** @jest-environment node */

import { VIEWING_SYSTEM_MESSAGE, formatViewingSlotLabel } from "./viewingConversationMessages";

describe("viewingConversationMessages", () => {
  test("formatViewingSlotLabel returns readable slot", () => {
    const label = formatViewingSlotLabel("2026-07-03", "11:00");
    expect(label).toMatch(/July/);
    expect(label).toMatch(/3/);
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
