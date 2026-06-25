# Discovery Extension Points

Architecture blueprint for future discovery intelligence features. Sprint 2.2 adds stubs only — no product UI.

## Future capabilities

| Feature | Purpose | Extension hook |
|---------|---------|----------------|
| Saved Searches | Persist filter snapshots + alerts | `useSavedSearches`, `savedSearchUtils`, future `?saved=<id>` hydration via `useSavedSearchHydration()` |
| Recently Viewed | Personal history on empty states | `recordRecentlyViewed(listingId)` — call from detail navigation (Sprint 2.3+) |
| Similar Listings | Detail-page recommendations | `fetchSimilarListingIds(anchorId)` |
| Recommended For You | Signed-in personalization | New hook `useRecommendedListings(userId)` — slot in search empty state |
| Popular Searches | Zero-result recovery | `getPopularSearchSuggestions()` — static list → analytics-driven |
| Search Analytics | Funnel + zero-result telemetry | `trackDiscoveryEvent(name, payload)` |
| Market Insights | Price/district trends | Separate data layer; link from search header CTA |

## Code extension points

### 1. Query builder interface

File: `src/lib/discoveryExtensionPoints.js`

```js
registerDiscoveryQueryBuilder({
  fetchResults: async (filters) => { /* Supabase RPC */ },
  toSupabaseParams: (filters) => ({ /* .eq/.gte chain */ }),
});
```

When registered, `search.jsx` can prefer server-filtered fetch over client `applySearchFilters()` without changing FilterBar or URL schema.

### 2. Filter state type

`SearchFilterState` in `src/lib/searchFilters.js` — extend with new keys (e.g. `lifestyle`, `featured`) and update:

- `parseSearchFiltersFromQuery`
- `buildSearchRouterQuery`
- `getActiveFilterChips`
- `applySearchFilters`

### 3. Empty-state slots

`PremiumEmptyState` on `/search` accepts custom secondary actions — wire:

- Popular searches (`getPopularSearchSuggestions`)
- Recently viewed carousel (new component)
- Saved search prompt (authenticated)

### 4. ListingCard hooks

`ListingCard` is canonical for cards; extension without forking:

- Post-click: `recordRecentlyViewed(listing.id)` in detail route only (not Sprint 2.3 yet)
- Badge slots already expose verification; future “Featured” ribbon via prop

### 5. Analytics events (recommended names)

| Event | When |
|-------|------|
| `discovery.search.apply` | URL filter change |
| `discovery.search.zero_results` | Empty grid after load |
| `discovery.filter.chip_remove` | Chip dismissed |
| `discovery.sort.change` | Sort param change |

Fire via `trackDiscoveryEvent()` — no-op until analytics provider connected.

## UI empty slots (minimal)

Search results header (`search.jsx`) — room for future “Market insight” link without layout redesign.

District `inventoryEndCap` — placeholder copy for pagination / infinite scroll (not implemented; full list rendered client-side).

## Dependencies between sprints

- **Sprint 2.3 (Listing detail)**: `recordRecentlyViewed`, similar listings anchor
- **Saved searches product**: extend `useSavedSearchHydration` + user dashboard panel
- **Backend search**: migration to Postgres full-text or Edge Function + `registerDiscoveryQueryBuilder`

## Files to touch when implementing features

1. `src/lib/searchFilters.js` — schema + apply logic
2. `src/lib/discoveryExtensionPoints.js` — register builders / trackers
3. `src/pages/search.jsx` — fetch strategy + empty slots
4. `docs/discovery/search-architecture.md` — keep audit current
