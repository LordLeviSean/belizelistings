/**
 * Relative timestamp for inbox rows and notification surfaces.
 * @param {string|number|Date|null|undefined} iso
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatRelativeTime(iso, nowMs = Date.now()) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = nowMs - d.getTime();
  if (diff < 0) return "Just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
