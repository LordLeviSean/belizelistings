/**
 * Discovery intelligence extension points (architecture only — Sprint 2.2).
 * Future features plug in here without rewriting search.jsx.
 *
 * @see docs/discovery/extension-points.md
 */

/**
 * @typedef {object} SearchFilterState
 * @property {string} q
 * @property {string} district
 * @property {string} subregion
 * @property {"all"|"sale"|"rent"} market
 * @property {string} minPrice
 * @property {string} maxPrice
 * @property {string} beds
 * @property {string} baths
 * @property {string} propertyType
 * @property {boolean} verifiedOnly
 * @property {string} sort
 */

/**
 * Query builder interface for future server-side search (Supabase RPC / Edge Function).
 * Client-side `applySearchFilters` remains default until wired.
 *
 * @typedef {object} DiscoveryQueryBuilder
 * @property {(filters: SearchFilterState) => Promise<object[]>} fetchResults
 * @property {(filters: SearchFilterState) => object} toSupabaseParams
 */

/** @type {DiscoveryQueryBuilder | null} */
export let activeDiscoveryQueryBuilder = null;

/** Register a server-side query builder (no-op until product enables it). */
export function registerDiscoveryQueryBuilder(builder) {
  activeDiscoveryQueryBuilder = builder;
}

/**
 * Saved searches — persist filter snapshots (see useSavedSearches + savedSearchUtils).
 * Extension: merge saved search id into URL as `?saved=<id>` and hydrate via this hook stub.
 */
export function useSavedSearchHydration(_savedSearchId) {
  return null;
}

/**
 * Recently viewed — append listing ids to session/local storage for empty-state recommendations.
 * Extension: call recordRecentlyViewed(listingId) from ListingCard detail navigation.
 */
export function recordRecentlyViewed(_listingId) {
  /* Sprint 2.3+ */
}

/** Similar listings slot — given anchor listing, return related ids (future ML or rule-based). */
export async function fetchSimilarListingIds(_listingId) {
  return [];
}

/** Popular searches — static or analytics-driven suggestions for empty search state. */
export function getPopularSearchSuggestions() {
  return [];
}

/** Search analytics — fire-and-forget event bus for filter apply, zero-result, etc. */
export function trackDiscoveryEvent(_eventName, _payload) {
  /* wire to analytics provider */
}
