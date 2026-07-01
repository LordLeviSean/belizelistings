import { isProfileComplete } from "./isProfileComplete";

/**
 * Mirrors create workspace submit gate — unit-testable without mounting the page.
 */
export function shouldBlockSubmitForReview(profile) {
  return !isProfileComplete(profile);
}

describe("profile completion submit gate", () => {
  it("blocks submit when phone missing", () => {
    expect(shouldBlockSubmitForReview({ email: "a@b.c" })).toBe(true);
  });

  it("allows submit when profile is complete", () => {
    expect(shouldBlockSubmitForReview({ phone: "+501 600 1234" })).toBe(false);
    expect(
      shouldBlockSubmitForReview({ profile_completed_at: "2026-07-01T00:00:00.000Z" })
    ).toBe(false);
  });
});
