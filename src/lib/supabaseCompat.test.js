import { extractMissingColumnName, isMissingColumnError } from "./supabaseCompat";

describe("supabaseCompat", () => {
  test("extractMissingColumnName parses Postgres-style messages", () => {
    expect(
      extractMissingColumnName({
        message: `column "archived_by" of relation "listings" does not exist`,
      })
    ).toBe("archived_by");
  });

  test("extractMissingColumnName reads nested cause and details", () => {
    expect(
      extractMissingColumnName({
        message: "Bad Request",
        details: `Could not find the 'lifecycle_status' column of 'listings' in the schema cache`,
      })
    ).toBe("lifecycle_status");
  });

  test("extractMissingColumnName: schema cache on message (verified_by)", () => {
    expect(
      extractMissingColumnName({
        message: `Could not find the 'verified_by' column of 'listings' in the schema cache`,
      })
    ).toBe("verified_by");
  });

  test("isMissingColumnError: schema cache without relying on word column in isolation", () => {
    expect(
      isMissingColumnError({
        message: `Could not find the 'verified_by' column of 'listings' in the schema cache`,
      })
    ).toBe(true);
  });

  test("isMissingColumnError aggregates message and details", () => {
    expect(
      isMissingColumnError({
        message: "something",
        details: `column "foo" does not exist`,
      })
    ).toBe(true);
  });
});
