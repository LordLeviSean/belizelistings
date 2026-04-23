/** Stable JSON for scroll keys and shallow compare (sorted keys, no empty values). */
export function stableStringifyQuery(query) {
  if (!query || typeof query !== "object") return "{}";
  const entries = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  const sorted = Object.fromEntries(entries);
  return JSON.stringify(sorted);
}

/** Build clean query object for router (omit empty). */
export function cleanQuery(query) {
  const out = {};
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}
