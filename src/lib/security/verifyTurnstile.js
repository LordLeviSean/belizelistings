const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify Cloudflare Turnstile token server-side.
 *
 * @param {string} token
 * @param {{ remoteIp?: string | null, secret?: string | null }} [options]
 * @returns {Promise<{ ok: boolean, error?: string, data?: Record<string, unknown> }>}
 */
export async function verifyTurnstileToken(token, { remoteIp = null, secret = null } = {}) {
  const secretKey = secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "turnstile_not_configured" };
  }
  if (!token || !String(token).trim()) {
    return { ok: false, error: "turnstile_token_missing" };
  }

  const body = {
    secret: secretKey,
    response: String(token).trim(),
  };
  if (remoteIp) {
    body.remoteip = remoteIp;
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data?.success === true) {
      return { ok: true, data };
    }
    return {
      ok: false,
      error: "turnstile_verification_failed",
      data,
    };
  } catch (e) {
    return { ok: false, error: e?.message || "turnstile_request_failed" };
  }
}
