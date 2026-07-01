import { formatRelativeTime } from "./formatRelativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-01T12:00:00Z").getTime();

  test("returns empty for invalid input", () => {
    expect(formatRelativeTime(null, now)).toBe("");
  });

  test("returns Just now for recent timestamps", () => {
    expect(formatRelativeTime("2026-07-01T11:59:30Z", now)).toBe("Just now");
  });

  test("returns minutes ago", () => {
    expect(formatRelativeTime("2026-07-01T11:30:00Z", now)).toBe("30m ago");
  });

  test("returns hours ago", () => {
    expect(formatRelativeTime("2026-07-01T08:00:00Z", now)).toBe("4h ago");
  });
});
