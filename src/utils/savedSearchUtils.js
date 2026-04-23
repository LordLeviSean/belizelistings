import { cleanQuery } from "./queryStringify";

/** @param {unknown} v */
function qv(v) {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/**
 * Normalize router query into persisted filter shape (numbers or null).
 * @param {import("next/router").NextRouter["query"] | Record<string, unknown>} query
 */
export function normalizeRouterQueryToFilters(query) {
  const statusRaw = String(qv(query.status) || "all");
  const status =
    statusRaw === "" || statusRaw === "all"
      ? "all"
      : statusRaw === "for-sale" || statusRaw === "rent"
        ? statusRaw
        : "all";

  const num = (x) => {
    const s = String(qv(x) ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  return {
    status,
    minPrice: num(query.minPrice),
    maxPrice: num(query.maxPrice),
    beds: num(query.beds),
    baths: num(query.baths),
  };
}

/** Format price for labels (e.g. 300000 → "300k"). */
function fmtPriceShort(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * Auto label: "For Sale · Under 300k · 3+ Beds"
 * @param {import("../hooks/useSavedSearches").SavedSearchFilters} filters
 */
export function generateSavedSearchLabel(filters) {
  const parts = [];

  if (filters.status === "for-sale") parts.push("For Sale");
  else if (filters.status === "rent") parts.push("For Rent");
  else parts.push("All listings");

  if (filters.maxPrice != null) {
    parts.push(`Under ${fmtPriceShort(filters.maxPrice)}`);
  } else if (filters.minPrice != null) {
    parts.push(`${fmtPriceShort(filters.minPrice)}+`);
  }

  if (filters.beds != null) parts.push(`${filters.beds}+ Beds`);
  if (filters.baths != null) parts.push(`${filters.baths}+ Baths`);

  return parts.join(" · ") || "Saved search";
}

/**
 * Map persisted filters to filterListings() input.
 * @param {import("../hooks/useSavedSearches").SavedSearchFilters} filters
 */
export function filtersToFilterListingsInput(filters) {
  return {
    status: filters.status || "all",
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    beds: filters.beds,
    baths: filters.baths,
  };
}

/**
 * Build URL query for home page from filters.
 * @param {import("../hooks/useSavedSearches").SavedSearchFilters} filters
 */
export function filtersToHomeQuery(filters) {
  return cleanQuery({
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    minPrice: filters.minPrice != null ? String(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice != null ? String(filters.maxPrice) : undefined,
    beds: filters.beds != null ? String(filters.beds) : undefined,
    baths: filters.baths != null ? String(filters.baths) : undefined,
  });
}

/** Readable filter line for list UI (not the auto label). */
export function formatFiltersSummary(filters) {
  const bits = [];
  bits.push(`Status: ${filters.status === "all" ? "All" : filters.status === "for-sale" ? "For sale" : "Rent"}`);
  if (filters.minPrice != null) bits.push(`Min ${filters.minPrice.toLocaleString()} BZD`);
  if (filters.maxPrice != null) bits.push(`Max ${filters.maxPrice.toLocaleString()} BZD`);
  if (filters.beds != null) bits.push(`${filters.beds}+ beds`);
  if (filters.baths != null) bits.push(`${filters.baths}+ baths`);
  return bits.join(" · ");
}
