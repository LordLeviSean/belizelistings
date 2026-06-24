import {
  PROFILE_OWNER_MINIMAL_SELECT,
  PROFILE_SELECT_TIERS,
  fetchProfileRowWithTiers,
} from "./profileSelectContract";
import { isMissingColumnError } from "./supabaseCompat";

describe("profileSelectContract", () => {
  it("PROFILE_SELECT_TIERS excludes verification columns not in migrations", () => {
    const blob = PROFILE_SELECT_TIERS.join(" ");
    expect(blob).not.toMatch(/verification_status/);
    expect(blob).not.toMatch(/agent_verification_status/);
    expect(blob).not.toMatch(/verified_at/);
    expect(blob).not.toMatch(/full_name/);
  });

  it("PROFILE_OWNER_MINIMAL_SELECT is migration-safe", () => {
    expect(PROFILE_OWNER_MINIMAL_SELECT).toBe("id, username, email, role");
  });

  it("PostgREST profiles missing-column 400 is detected for tier fallback", () => {
    const postgrestShape = {
      status: 400,
      message: "Bad Request",
      details:
        "Could not find the 'verification_status' column of 'profiles' in the schema cache",
    };
    expect(isMissingColumnError(postgrestShape)).toBe(true);
  });

  it("fetchProfileRowWithTiers steps down on missing-column errors", async () => {
    const wideErr = {
      message: "Bad Request",
      details:
        "Could not find the 'updated_at' column of 'profiles' in the schema cache",
    };
    const narrowRow = { id: "u1", email: "a@b.c", role: "user" };
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: wideErr })
      .mockResolvedValueOnce({ data: narrowRow, error: null });

    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle,
          }),
        }),
      }),
    };

    const { data, error } = await fetchProfileRowWithTiers(client, "u1", [
      "id, email, role, username, created_at, updated_at",
      "id, email, role, username",
    ]);

    expect(error).toBeNull();
    expect(data).toEqual(narrowRow);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
