/**
 * Extension stubs for future abuse-protection providers.
 * v1.6.7 ships Turnstile + honeypot + DB rate limits; these hooks allow
 * swapping or layering providers without rewriting inquiry API routes.
 */

/** @returns {Promise<{ ok: boolean, provider: 'recaptcha', error?: string }>} */
export async function verifyRecaptchaToken(_token, _options = {}) {
  return { ok: false, provider: "recaptcha", error: "not_implemented" };
}

/** @returns {Promise<{ ok: boolean, provider: 'hcaptcha', error?: string }>} */
export async function verifyHcaptchaToken(_token, _options = {}) {
  return { ok: false, provider: "hcaptcha", error: "not_implemented" };
}

/**
 * @param {{ message?: string, senderEmail?: string, listingId?: number }} _payload
 * @returns {Promise<{ score: number, flagged: boolean, provider: 'ai_spam' }>}
 */
export async function scoreInquiryWithAiSpamModel(_payload) {
  return { score: 0, flagged: false, provider: "ai_spam" };
}

/**
 * Composite abuse score (0–100). Higher = more suspicious.
 * @param {{ honeypotFilled?: boolean, captchaFailed?: boolean, rateLimited?: boolean }} signals
 * @returns {{ score: number, action: 'allow' | 'review' | 'block' }}
 */
export function computeAbuseScore(signals = {}) {
  let score = 0;
  if (signals.honeypotFilled) score += 100;
  if (signals.captchaFailed) score += 60;
  if (signals.rateLimited) score += 40;
  const action = score >= 100 ? "block" : score >= 60 ? "review" : "allow";
  return { score, action };
}
