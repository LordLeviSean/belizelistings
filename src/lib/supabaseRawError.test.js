import { snapshotSupabaseError } from "./supabaseRawError";

describe("supabaseRawError", () => {
  test("snapshotSupabaseError preserves code, details, hint, message", () => {
    const err = {
      name: "Error",
      message: 'invalid input value for enum listing_status: "archived"',
      details: "Failing row contains (...)",
      hint: null,
      code: "23514",
    };
    const s = snapshotSupabaseError(err);
    expect(s.message).toContain("archived");
    expect(s.code).toBe("23514");
    expect(s.details).toBeTruthy();
  });
});
