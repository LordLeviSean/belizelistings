/**
 * Short display name for greetings (username → email local-part → full_name).
 * @param {{ username?: string | null, email?: string | null, full_name?: string | null }} fields
 * @returns {string} empty string if nothing usable (caller shows generic "Welcome!")
 */
export function resolveDashboardGreetingName(fields = {}) {
  const u = String(fields.username ?? "").trim();
  if (u) return u;
  const em = String(fields.email ?? "").trim();
  if (em.includes("@")) {
    const local = em.split("@")[0]?.trim();
    if (local) return local;
  }
  const fn = String(fields.full_name ?? "").trim();
  if (fn) return fn;
  return "";
}

/**
 * @param {{ username?: string | null, email?: string | null, full_name?: string | null }} profileLike
 * @returns {"Welcome!" | string}
 */
export function formatWelcomeGreeting(profileLike = {}) {
  const name = resolveDashboardGreetingName(profileLike);
  if (!name) return "Welcome!";
  return `Welcome, ${name}!`;
}
