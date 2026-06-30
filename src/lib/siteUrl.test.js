import {
  buildAuthRedirectUrl,
  isLocalhostUrl,
  isProductionBuild,
  normalizeSiteUrl,
  PRODUCTION_SITE_URL,
  resolveSiteUrl,
} from "./siteUrl";

describe("normalizeSiteUrl", () => {
  test("returns origin without trailing slash", () => {
    expect(normalizeSiteUrl("https://belizelistings.bz/")).toBe("https://belizelistings.bz");
    expect(normalizeSiteUrl("belizelistings.bz")).toBe("https://belizelistings.bz");
  });

  test("returns null for invalid values", () => {
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl("   ")).toBeNull();
    expect(normalizeSiteUrl(undefined)).toBeNull();
  });
});

describe("isLocalhostUrl", () => {
  test("detects localhost origins", () => {
    expect(isLocalhostUrl("http://localhost:3000")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalhostUrl("https://belizelistings.bz")).toBe(false);
  });
});

describe("resolveSiteUrl", () => {
  test("uses site URL env in development", () => {
    expect(resolveSiteUrl({ siteUrlEnv: "http://localhost:3000", nodeEnv: "development" })).toBe(
      "http://localhost:3000"
    );
  });

  test("never uses localhost in production builds even when env says localhost", () => {
    expect(resolveSiteUrl({ siteUrlEnv: "http://localhost:3000", nodeEnv: "production" })).toBe(
      PRODUCTION_SITE_URL
    );
  });

  test("uses production env URL in production builds", () => {
    expect(resolveSiteUrl({ siteUrlEnv: "https://belizelistings.bz", nodeEnv: "production" })).toBe(
      "https://belizelistings.bz"
    );
  });

  test("falls back to production URL in production when env unset", () => {
    expect(resolveSiteUrl({ nodeEnv: "production" })).toBe(PRODUCTION_SITE_URL);
  });

  test("falls back to localhost in development when env unset", () => {
    expect(resolveSiteUrl({ nodeEnv: "development" })).toBe("http://localhost:3000");
  });

  test("uses window origin in development when env unset", () => {
    expect(resolveSiteUrl({ nodeEnv: "development", windowOrigin: "http://127.0.0.1:3001" })).toBe(
      "http://127.0.0.1:3001"
    );
  });
});

describe("buildAuthRedirectUrl", () => {
  test("builds auth callback URL from site origin", () => {
    expect(
      buildAuthRedirectUrl("/auth/callback", { siteUrlEnv: "https://belizelistings.bz", nodeEnv: "production" })
    ).toBe("https://belizelistings.bz/auth/callback");
  });

  test("supports custom paths", () => {
    expect(
      buildAuthRedirectUrl("/reset-password", { siteUrlEnv: "https://belizelistings.bz", nodeEnv: "production" })
    ).toBe("https://belizelistings.bz/reset-password");
  });
});

describe("isProductionBuild", () => {
  test("reflects nodeEnv argument", () => {
    expect(isProductionBuild("production")).toBe(true);
    expect(isProductionBuild("development")).toBe(false);
    expect(isProductionBuild("test")).toBe(false);
  });
});
