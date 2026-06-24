/**
 * Short display name for greetings (username → email local-part → full_name).
 * @param {{ username?: string | null, email?: string | null, full_name?: string | null }} fields
 * @returns {string} empty string if nothing usable (caller shows generic "Welcome back")
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
 * @returns {"Welcome back" | string}
 */
export function formatWelcomeGreeting(profileLike = {}) {
  const name = resolveDashboardGreetingName(profileLike);
  if (!name) return "Welcome back";
  return `Welcome, ${name}!`;
}

/**
 * Regular user dashboard only: username identity, no email in the greeting path.
 * @param {{ username?: string | null }} fields
 * @returns {"Welcome back!" | `Welcome, ${string}!`}
 */
export function formatUserDashboardGreeting(fields = {}) {
  const u = String(fields.username ?? "").trim();
  if (u) return `Welcome, ${u}!`;
  return "Welcome back!";
}

/**
 * Full dashboard subtitle for standard users: username-only welcome clause + fixed editorial tail.
 * Never uses email (delegates welcome clause to {@link formatUserDashboardGreeting}).
 * @param {{ username?: string | null }} fields
 */
export function formatUserDashboardSubtitle(fields = {}) {
  const head = formatUserDashboardGreeting(fields);
  return `${head} Explore Belize, save favorites, and manage your listings.`;
}
