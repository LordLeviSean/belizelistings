const COOLDOWN_MS = 60_000;
const lastSentByUser = new Map();

/**
 * Conservative per-user cooldown for deliberate test pushes.
 * @param {string} userId
 * @param {number} [now]
 */
export function checkPushTestRateLimit(userId, now = Date.now()) {
  if (!userId) {
    return { allowed: false, retryAfterMs: COOLDOWN_MS };
  }

  const last = lastSentByUser.get(userId);
  if (last && now - last < COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterMs: COOLDOWN_MS - (now - last),
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** @param {string} userId @param {number} [now] */
export function recordPushTestSent(userId, now = Date.now()) {
  if (!userId) return;
  lastSentByUser.set(userId, now);
}

/** Test-only reset. */
export function __resetPushTestRateLimitForTests() {
  lastSentByUser.clear();
}

export const PUSH_TEST_COOLDOWN_MS = COOLDOWN_MS;
