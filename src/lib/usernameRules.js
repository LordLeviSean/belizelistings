/** Allowed: letters, numbers, underscore, period, hyphen (stored normalized). */
export const USERNAME_MIN_LEN = 2;
export const USERNAME_MAX_LEN = 32;
/** Public signup — slightly stricter length; same charset as admin. */
export const SIGNUP_USERNAME_MIN = 3;
export const SIGNUP_USERNAME_MAX = 24;
const USERNAME_RE = /^[a-z0-9._-]+$/;

/**
 * Trim + lowercase for persistence and duplicate checks.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeUsername(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} raw
 * @returns {{ ok: true, username: string } | { ok: false, message: string }}
 */
export function validateUsernameCandidate(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, message: "Username is required." };
  }
  if (username.length < USERNAME_MIN_LEN) {
    return { ok: false, message: `Username must be at least ${USERNAME_MIN_LEN} characters.` };
  }
  if (username.length > USERNAME_MAX_LEN) {
    return { ok: false, message: `Username must be at most ${USERNAME_MAX_LEN} characters.` };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      message: "Use letters, numbers, underscores, periods, or hyphens only.",
    };
  }
  if (username.startsWith(".") || username.startsWith("-") || username.endsWith(".") || username.endsWith("-")) {
    return { ok: false, message: "Username cannot start or end with . or -." };
  }
  if (username.includes("..")) {
    return { ok: false, message: "Username cannot contain consecutive periods." };
  }
  return { ok: true, username };
}

/**
 * Public Create Account — live validation (no network).
 * @param {string} raw
 * @returns {{ ok: true, username: string } | { ok: false, code: string, message?: string }}
 */
export function validateSignupUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, code: "empty" };
  }
  if (username.length < SIGNUP_USERNAME_MIN) {
    return {
      ok: false,
      code: "short",
      message: `Use at least ${SIGNUP_USERNAME_MIN} characters.`,
    };
  }
  if (username.length > SIGNUP_USERNAME_MAX) {
    return {
      ok: false,
      code: "length",
      message: `Use at most ${SIGNUP_USERNAME_MAX} characters.`,
    };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      code: "invalid",
      message: "Use letters, numbers, underscores, or periods.",
    };
  }
  if (username.startsWith(".") || username.startsWith("-") || username.endsWith(".") || username.endsWith("-")) {
    return {
      ok: false,
      code: "invalid",
      message: "Username cannot start or end with . or -.",
    };
  }
  if (username.includes("..")) {
    return {
      ok: false,
      code: "invalid",
      message: "Username cannot contain consecutive periods.",
    };
  }
  return { ok: true, username };
}
