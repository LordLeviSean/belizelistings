import {
  hasAuthTokensInUrl,
  normalizeQueryParam,
  parseHashParams,
  pickAuthError,
  pickAuthLinkType,
  resolveAuthCallbackDestination,
  shouldEnsureProfile,
} from "./authCallback";

describe("parseHashParams", () => {
  test("parses hash fragment params", () => {
    expect(parseHashParams("#access_token=abc&type=signup")).toEqual({
      access_token: "abc",
      type: "signup",
    });
  });

  test("accepts raw hash without leading #", () => {
    expect(parseHashParams("type=recovery&access_token=x")).toEqual({
      type: "recovery",
      access_token: "x",
    });
  });

  test("returns empty object for missing hash", () => {
    expect(parseHashParams("")).toEqual({});
    expect(parseHashParams(undefined)).toEqual({});
  });
});

describe("pickAuthLinkType", () => {
  test("prefers PASSWORD_RECOVERY event", () => {
    expect(pickAuthLinkType({ hashType: "signup", authEvent: "PASSWORD_RECOVERY" })).toBe("recovery");
  });

  test("reads type from hash then query", () => {
    expect(pickAuthLinkType({ hashType: "signup" })).toBe("signup");
    expect(pickAuthLinkType({ queryType: "recovery" })).toBe("recovery");
  });
});

describe("pickAuthError", () => {
  test("decodes hash error_description", () => {
    expect(
      pickAuthError({
        hashParams: { error_description: "Email%20link%20is%20invalid%20or%20has%20expired" },
      })
    ).toBe("Email link is invalid or has expired");
  });

  test("falls back to query error params", () => {
    expect(pickAuthError({ queryParams: { error: "access_denied" } })).toBe("access_denied");
  });
});

describe("resolveAuthCallbackDestination", () => {
  test("routes signup verification to dashboard", () => {
    expect(resolveAuthCallbackDestination({ linkType: "signup", hasUser: true })).toEqual({
      status: "success",
      message: "Email verified. Redirecting…",
      dest: "/dashboard",
    });
  });

  test("routes recovery to reset password", () => {
    expect(resolveAuthCallbackDestination({ linkType: "recovery", hasUser: true })).toEqual({
      status: "success",
      message: "Redirecting to reset your password…",
      dest: "/reset-password",
    });
  });

  test("routes missing user to login with verified=0", () => {
    expect(resolveAuthCallbackDestination({ linkType: "signup", hasUser: false })).toEqual({
      status: "error",
      message: "Verification link expired or invalid. Sign in or request a new link.",
      dest: "/login?verified=0",
    });
  });
});

describe("hasAuthTokensInUrl", () => {
  test("detects PKCE code", () => {
    expect(hasAuthTokensInUrl({ code: "pkce-code" })).toBe(true);
  });

  test("detects hash tokens", () => {
    expect(hasAuthTokensInUrl({ hashParams: { access_token: "tok" } })).toBe(true);
    expect(hasAuthTokensInUrl({ hashParams: { type: "signup" } })).toBe(true);
  });

  test("false when URL carries no auth metadata", () => {
    expect(hasAuthTokensInUrl({ hashParams: {}, code: null })).toBe(false);
  });
});

describe("shouldEnsureProfile", () => {
  test("skips profile ensure for recovery", () => {
    expect(shouldEnsureProfile("recovery")).toBe(false);
  });

  test("runs profile ensure for signup and other flows", () => {
    expect(shouldEnsureProfile("signup")).toBe(true);
    expect(shouldEnsureProfile(null)).toBe(true);
  });
});

describe("normalizeQueryParam", () => {
  test("unwraps array query values", () => {
    expect(normalizeQueryParam(["recovery", "ignored"])).toBe("recovery");
  });
});
