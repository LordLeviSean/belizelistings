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
