# Search Architecture

Sprint 2.2 audit of the BelizeListings property discovery pipeline. Homepage v1.0 remains frozen; this document covers search entry, state, routing, filtering, and results rendering.

## Search entry points

| Entry | Route / action | Params written | Notes |
|-------|----------------|----------------|-------|
| Homepage hero search | `index.js` form submit | `/search?q=` | Enter-only; no live filter on homepage beyond Recent rail local filter |
| Homepage advanced filters | `HomeAdvancedFiltersModal` | `/search?q&district&market` | Uses `buildSearchRouterQuery()` from `src/lib/searchFilters.js` |
| Search results page | `/search` | URL is source of truth | Full filter bar + chips |
| District browse | `/listings/district/[district]` | `status`, `subregion` in URL | Separate UX shell (`DistrictLayout`); shares `filterListings()` |
| Map district click | `BelizeMap` / homepage | `/listings/district/{slug}` | Not `/search` — geographic discovery path |
| Site nav | `SiteNav` | Highlights browse on `/search` and district routes | No dedicated nav search field |

There is **no global Zustand/Redux search store**. Discovery state lives in the Next.js router query (deep-linkable) plus ephemeral UI state (debounced keyword draft, advanced panel open).

## State management

### URL parameters (`/search`)

| Param | Canonical key | Parsed by |
|-------|---------------|-----------|
| Keyword | `q` (alias `query`) | `parseSearchFiltersFromQuery` |
| Region | `district` | same |
| Subregion | `subregion` | same |
| Market | `market` (alias `status`) | `all` · `sale` · `rent` |
| Price min/max | `minPrice`, `maxPrice` | same |
| Beds / baths | `beds`, `baths` | same |
| Property type | `type` | same |
| Verified only | `verified=1` | uses `listing.verification_status` |
| Sort | `sort` | `newest` · `price-asc` · `price-desc` |

Shallow `router.replace` updates filters without scroll jump. Browser back/forward restores prior filter sets.

### React state (ephemeral)

- `search.jsx`: listing fetch cache, loading flag, debounced keyword draft (`draftQuery`), advanced panel visibility.
- `index.js`: homepage `searchTerm` (local Recent rail only until submit).
- District page: most filters in component state; **status/subregion** synced to URL.

## Routing

```
Homepage ──submit q──► /search?q=…
Homepage modal ──apply──► /search?…
BelizeMap ──click──► /listings/district/:slug
District filters ──shallow replace──► /listings/district/:slug?status=&subregion=
Search FilterBar ──shallow replace──► /search?…
```

## Query parsing & filter application

1. **Supabase fetch** — `fetchApprovedListingsWithImages()` loads all approved public inventory once per page mount (no server-side filter params today).
2. **Canonical client filter** — `applySearchFilters()` in `src/lib/searchFilters.js`:
   - Delegates region/market/price/beds/baths to `filterListings()` (`src/utils/filterListings.js`)
   - Adds subregion, property type, verified (`isListingCardVerified`), and keyword haystack match
3. **Sort** — `sortSearchResults()` client-side after filter (newest default).

Keyword haystack: title, region label, property type, lifecycle status, price (case-insensitive substring).

## Supabase query construction

Public browse uses a **single bulk select**:

```js
supabase.from("listings").select("*, listing_images (*)").or("status.eq.approved,moderation_status.eq.approved")
```

Post-fetch: `filterPublicInventory()` + `mapListingWithImages()`. No SQL `WHERE` for search filters yet — extension point: `registerDiscoveryQueryBuilder()` in `src/lib/discoveryExtensionPoints.js`.

## Ranking / sorting

| Surface | Default | Options |
|---------|---------|---------|
| `/search` | Newest (`created_at` / `updated_at`) | Price asc/desc via URL `sort` |
| District page | Newest | Price asc/desc (local state) |
| Homepage featured | Newest 12 | Fixed carousel |
| Homepage recent | Newest pool minus featured | Local keyword filter only |

No relevance ranking or full-text search index today.

## Empty & loading states

| Surface | Loading | Empty |
|---------|---------|-------|
| `/search` | 6-card skeleton pulse (`SearchResults.module.css`) | `PremiumEmptyState` variant `search` + reset CTA |
| District | 6-card skeleton in grid | `PremiumEmptyState` variant `district` |
| Homepage recent | N/A (sync from cached data) | Inline editorial empty copy |

## Mobile vs desktop

- **FilterBar**: horizontal scroll on ≤900px; sticky below nav offset.
- **Homepage**: compact search placeholder ≤760px; map section moves below hero on mobile.
- **District**: `DistrictLayout` filter grid wraps; advanced panel expands inline.
- **Search**: single-column results grid ≤900px.

## Duplicated logic (consolidation status)

| Logic | Previous copies | Canonical source (Sprint 2.2) |
|-------|-----------------|-------------------------------|
| Market kind (sale/rent) | `search.jsx`, `index.js`, `ListingCard.jsx`, `filterListings.js` | `getListingMarketKind()` in `filterListings.js` (search page deduped) |
| Keyword haystack | `search.jsx`, `index.js` | `listingMatchesSearchQuery()` in `searchFilters.js` |
| URL → filters | Ad hoc in search, modal, savedSearchUtils | `parseSearchFiltersFromQuery` / `buildSearchRouterQuery` |
| Region filter | Inline in search, `filterListings`, district | `filterListings` + subregion in `searchFilters` |
| Verified filter | District used legacy `listing.verified` | `isListingCardVerified()` (`verification_status`) |
| Filter UI | Unused `FilterBar`, district inline selects | `FilterBar` wired on `/search`; district keeps `DistrictLayout` |

**Intentional parallel paths:** district browse retains richer local-only advanced filters (amenities, lot size, etc.) not yet promoted to `/search` URL schema.

## Key files

- `src/pages/search.jsx` — search results shell
- `src/components/FilterBar.jsx` — canonical search filter UI
- `src/lib/searchFilters.js` — parse, build, apply, sort, chips
- `src/utils/filterListings.js` — shared region/market/price/beds/baths
- `src/components/HomeAdvancedFiltersModal.jsx` — homepage → search handoff
- `src/pages/listings/district/[district].jsx` — district discovery
- `src/lib/listingQueries.js` — Supabase fetch
- `src/components/ListingCard.jsx` — single results card
