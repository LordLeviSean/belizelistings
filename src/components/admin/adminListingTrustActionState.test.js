import { shouldSkipVerificationRealtimeReload } from "./adminListingTrustActionState";

describe("adminListingTrustActionState", () => {
  test("shouldSkipVerificationRealtimeReload blocks during verify action", () => {
    expect(shouldSkipVerificationRealtimeReload("listing-1:verify")).toBe(true);
  });

  test("shouldSkipVerificationRealtimeReload allows reload when idle", () => {
    expect(shouldSkipVerificationRealtimeReload("")).toBe(false);
    expect(shouldSkipVerificationRealtimeReload("listing-1:archive")).toBe(false);
  });
});
