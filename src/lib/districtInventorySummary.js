/**
 * Human-readable district browse inventory line.
 * @param {{ filtered: number, total: number, hasActiveFilters?: boolean }} args
 */
export function formatDistrictInventorySummary({ filtered, total, hasActiveFilters = false }) {
  const safeFiltered = Math.max(0, Number(filtered) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  if (hasActiveFilters && safeTotal !== safeFiltered) {
    const noun = safeFiltered === 1 ? "Property" : "Properties";
    return `Showing ${safeFiltered} of ${safeTotal} ${noun}`;
  }
  if (safeFiltered === 1) return "1 Property Available";
  const noun = safeFiltered === 1 ? "Property" : "Properties";
  return `Showing ${safeFiltered} ${noun}`;
}
