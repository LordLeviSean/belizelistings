/** @jest-environment node */

jest.mock("../profileSelectContract", () => ({
  fetchProfileRowWithTiers: jest.fn(),
  PROFILE_ROLE_ONLY_SELECT: "role",
}));

import { fetchProfileRowWithTiers } from "../profileSelectContract";
import {
  isAuthorizedPushMutationRequest,
  isVerifiedAdminProfile,
  loadVerifiedAdminProfile,
  readBearerToken,
} from "./pushApiAuth";

describe("pushApiAuth", () => {
  test("accepts allowed origin and referer", () => {
    expect(
      isAuthorizedPushMutationRequest({
        headers: { origin: "https://belizelistings.bz" },
      })
    ).toBe(true);
    expect(
      isAuthorizedPushMutationRequest({
        headers: { referer: "https://belizelistings.bz/dashboard/user?tab=profile" },
      })
    ).toBe(true);
    expect(
      isAuthorizedPushMutationRequest({
        headers: { origin: "https://evil.example" },
      })
    ).toBe(false);
  });

  test("reads bearer token", () => {
    expect(readBearerToken({ headers: { authorization: "Bearer abc123" } })).toBe("abc123");
  });

  test("isVerifiedAdminProfile accepts only admin role", () => {
    expect(isVerifiedAdminProfile({ role: "admin" })).toBe(true);
    expect(isVerifiedAdminProfile({ role: "user" })).toBe(false);
    expect(isVerifiedAdminProfile({ role: "agent" })).toBe(false);
    expect(isVerifiedAdminProfile({ role: "broker" })).toBe(false);
  });

  test("loadVerifiedAdminProfile uses service-role profile lookup", async () => {
    fetchProfileRowWithTiers.mockResolvedValue({ data: { role: "admin" }, error: null });
    const adminClient = { from: jest.fn() };
    await expect(loadVerifiedAdminProfile(adminClient, "user-1")).resolves.toEqual({ role: "admin" });
    expect(fetchProfileRowWithTiers).toHaveBeenCalledWith(adminClient, "user-1", ["role"]);
  });
});
