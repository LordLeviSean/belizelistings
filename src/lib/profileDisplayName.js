/**
 * Canonical display label for a platform profile row (admin moderation, ownership strips).
 * Order: username → full_name → email local-part → short id.
 *
 * @param {{ username?: string|null, full_name?: string|null, email?: string|null, id?: string|null }} row
 * @returns {string}
 */
export function formatProfileDisplayLabel(row) {
  const u = String(row?.username ?? "").trim();
  if (u) return u;
  const fn = String(row?.full_name ?? "").trim();
  if (fn) return fn;
  const em = String(row?.email ?? "").trim();
  if (em) {
    const local = em.split("@")[0]?.trim();
    if (local) return local;
  }
  const id = String(row?.id ?? "").trim();
  if (id) return id.slice(0, 8);
  return "—";
}

function titleCaseToken(token) {
  const t = String(token ?? "").trim();
  if (!t) return "";
  if (t.length <= 2 && /^[a-z]+$/i.test(t)) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Human-friendly capitalized name for public contact surfaces (listing modals, agent cards).
 * @param {{ username?: string|null, full_name?: string|null, email?: string|null, display_name?: string|null }} row
 * @returns {string}
 */
export function formatCapitalizedProfileDisplayName(row) {
  const explicit = String(row?.display_name ?? "").trim();
  if (explicit) {
    return explicit
      .split(/\s+/)
      .map(titleCaseToken)
      .filter(Boolean)
      .join(" ");
  }
  const fn = String(row?.full_name ?? "").trim();
  if (fn) {
    return fn
      .split(/\s+/)
      .map(titleCaseToken)
      .filter(Boolean)
      .join(" ");
  }
  const u = String(row?.username ?? "").trim();
  if (u) {
    return u
      .replace(/[._-]+/g, " ")
      .split(/\s+/)
      .map(titleCaseToken)
      .filter(Boolean)
      .join(" ");
  }
  const em = String(row?.email ?? "").trim();
  if (em.includes("@")) {
    const local = em.split("@")[0]?.trim();
    if (local) {
      return local
        .replace(/[._-]+/g, " ")
        .split(/\s+/)
        .map(titleCaseToken)
        .filter(Boolean)
        .join(" ");
    }
  }
  return "";
}
