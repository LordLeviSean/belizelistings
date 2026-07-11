/** @jest-environment node */

import { loginHref, LOGIN_PATH } from "./authRoutes";

describe("authRoutes", () => {
  test("loginHref includes signup and safe returnTo query params", () => {
    expect(loginHref()).toBe("/login");
    expect(loginHref({ signup: true })).toBe("/login?signup=1");
    expect(loginHref({ returnTo: "/listing/abc-123" })).toBe(
      "/login?returnTo=%2Flisting%2Fabc-123"
    );
    expect(loginHref({ signup: true, returnTo: "/listing/xyz" })).toBe(
      "/login?signup=1&returnTo=%2Flisting%2Fxyz"
    );
    expect(loginHref({ returnTo: "https://evil.com" })).toBe("/login");
    expect(loginHref({ returnTo: "/login" })).toBe("/login");
  });
});
