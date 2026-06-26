/** @jest-environment node */

import { verifyTurnstileToken } from "./verifyTurnstile";

describe("verifyTurnstileToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns not configured when secret missing", async () => {
    const result = await verifyTurnstileToken("token", { secret: "" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("turnstile_not_configured");
  });

  test("returns missing when token empty", async () => {
    const result = await verifyTurnstileToken("", { secret: "test-secret" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("turnstile_token_missing");
  });

  test("returns ok when Cloudflare verifies success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    const result = await verifyTurnstileToken("good-token", { secret: "test-secret" });
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("returns failure when Cloudflare rejects token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid-input-response"] }),
    });

    const result = await verifyTurnstileToken("bad-token", { secret: "test-secret" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("turnstile_verification_failed");
  });
});
