/** @returns {boolean} Skip postgres_changes reload while verify/unverify mutation is in flight. */
export function shouldSkipVerificationRealtimeReload(actionKey = "") {
  return String(actionKey).endsWith(":verify");
}
