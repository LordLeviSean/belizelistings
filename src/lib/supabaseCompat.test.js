import {
  extractMissingColumnName,
  isMissingColumnError,
  isMissingRelationshipError,
  isMissingTableError,
  isPermissionDeniedCountError,
  isNonRecoverableMutationError,
  isTerminalDashboardCountError,
  isTransientNetworkError,
} from "./supabaseCompat";

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

  test("extractMissingColumnName: profiles schema cache (verification_status)", () => {
    expect(
      extractMissingColumnName({
        details:
          "Could not find the 'verification_status' column of 'profiles' in the schema cache",
      })
    ).toBe("verification_status");
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

  test("isMissingColumnError: PostgreSQL 42703", () => {
    expect(isMissingColumnError({ code: "42703", message: "undefined_column" })).toBe(true);
  });

  test("isMissingRelationshipError: embed / FK not in schema cache", () => {
    expect(
      isMissingRelationshipError({
        message:
          "Could not find a relationship between 'listings' and 'listing_images' in the schema cache",
      })
    ).toBe(true);
  });

  test("isMissingTableError: PGRST205", () => {
    expect(isMissingTableError({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
  });

  test("isMissingTableError: HTTP 404 on resource", () => {
    expect(isMissingTableError({ message: "Not Found", status: 404 })).toBe(true);
  });

  test("isTerminalDashboardCountError aggregates terminal classes", () => {
    expect(isTerminalDashboardCountError({ code: "PGRST205" })).toBe(true);
    expect(isTerminalDashboardCountError({ code: "42703" })).toBe(true);
    expect(isTerminalDashboardCountError({ message: "network down" })).toBe(false);
  });

  test("isNonRecoverableMutationError: RLS and missing-column distinction", () => {
    expect(isNonRecoverableMutationError({ status: 403, message: "Forbidden" })).toBe(true);
    expect(
      isNonRecoverableMutationError({
        message: `Could not find the 'verified_by' column of 'listings' in the schema cache`,
      })
    ).toBe(false);
  });

  test("isNonRecoverableMutationError: NOT NULL (23502) and HTTP 400", () => {
    expect(
      isNonRecoverableMutationError({
        code: "23502",
        message: 'null value in column "district" violates not-null constraint',
      })
    ).toBe(true);
    expect(isNonRecoverableMutationError({ status: 400, message: "Bad Request" })).toBe(true);
  });

  test("isTransientNetworkError: gateway vs terminal", () => {
    expect(isTransientNetworkError({ status: 503, message: "Service Unavailable" })).toBe(true);
    expect(isTransientNetworkError({ code: "PGRST205", message: "Could not find the table" })).toBe(
      false
    );
  });

  test("isPermissionDeniedCountError: HTTP 403 and Postgres 42501", () => {
    expect(isPermissionDeniedCountError({ status: 403, message: "Forbidden" })).toBe(true);
    expect(isPermissionDeniedCountError({ code: "42501", message: "permission denied" })).toBe(true);
    expect(isPermissionDeniedCountError({ message: "permission denied for table favorites" })).toBe(
      true
    );
    expect(isTerminalDashboardCountError({ status: 403, message: "Forbidden" })).toBe(true);
  });
});
