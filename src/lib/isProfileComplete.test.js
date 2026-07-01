import { isProfileComplete, profileCompletionMissingReason } from "./isProfileComplete";

describe("isProfileComplete", () => {
  it("returns false when profile is missing or phone absent", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({})).toBe(false);
    expect(isProfileComplete({ phone: "" })).toBe(false);
    expect(isProfileComplete({ phone: "123" })).toBe(false);
  });

  it("returns true when phone has at least 7 digits", () => {
    expect(isProfileComplete({ phone: "+501 600-1234" })).toBe(true);
    expect(isProfileComplete({ phone: "5016001234" })).toBe(true);
  });

  it("returns true when profile_completed_at is set even without phone in payload", () => {
    expect(isProfileComplete({ profile_completed_at: "2026-07-01T00:00:00Z" })).toBe(true);
  });

  it("profileCompletionMissingReason explains phone requirement", () => {
    expect(profileCompletionMissingReason({})).toMatch(/phone/i);
    expect(profileCompletionMissingReason({ phone: "+501 622 9999" })).toBeNull();
  });
});
