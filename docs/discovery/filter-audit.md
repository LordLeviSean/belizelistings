# Filter Audit

Sprint 2.2 inventory of discovery filters across BelizeListings surfaces.

Legend: **Implemented** · **Partial** · **Placeholder** · **Duplicated** · **Unused**

## Summary matrix

| Filter | `/search` | District page | Homepage | FilterBar component | `filterListings.js` | `searchFilters.js` | Status |
|--------|-----------|---------------|----------|---------------------|---------------------|-------------------|--------|
| District / Region | URL `district` | Route segment | Map + modal | — | Yes | Yes | **Implemented** (search + district) |
| Subregion | URL `subregion` | URL `subregion` | — | — | Partial (child region via district) | Yes | **Partial** (district primary) |
| Property type | URL `type` | Local state | — | Advanced panel | — | Yes | **Partial** (search + district; not homepage) |
| Status (For sale / rent) | URL `market` | URL `status` | Stats only | Toggle tabs | Yes | Yes | **Implemented** (duplicated param names) |
| Price min | URL `minPrice` | Bucket select | — | Select | Yes | Yes | **Implemented** on search |
| Price max | URL `maxPrice` | Bucket select | — | Select | Yes | Yes | **Implemented** on search |
| Bedrooms | URL `beds` | Local state | — | Select | Yes | Yes | **Implemented** |
| Bathrooms | URL `baths` | Local state | — | Select | Yes | Yes | **Implemented** |
| Land vs residential | Implicit via beds/baths skip | Implicit | — | — | Yes (`isLandInventoryListing`) | Via `filterListings` | **Partial** (no explicit land toggle) |
| Commercial | Property type includes `commercial` | Type select | — | Advanced | — | Substring match | **Partial** |
| Lifestyle | — | — | Placeholder copy only | — | — | — | **Placeholder** (keyword only) |
| Featured | — | — | Homepage section | — | — | — | **Unused** on search (homepage-only) |
| Verified | URL `verified=1` | Advanced checkbox | — | Advanced checkbox | — | Yes (`verification_status`) | **Implemented** (Sprint 2.2) |
| Recently added | Sort default newest | Sort default | Recent rail | Sort select | — | Sort only | **Partial** (sort proxy, not dedicated filter) |
| Amenities / view / furnishing / lot | — | Advanced local | — | — | — | — | **Implemented** district-only |
| Agent / listing ID | — | Advanced local | — | — | — | — | **Implemented** district-only |

## Duplicated logic (target: one source)

| Concern | Canonical module | Notes |
|---------|------------------|-------|
| URL parse / build | `src/lib/searchFilters.js` | Homepage modal migrated Sprint 2.2 |
| Region + market + price + beds/baths | `src/utils/filterListings.js` | Used by search, district, homepage counts |
| Verified badge + filter | `src/utils/listingVerification.js` | `verification_status` only |
| Saved search shape | `src/utils/savedSearchUtils.js` | Aligns with `filterListings` input; extend for full search URL later |
| District-only advanced filters | `[district].jsx` local | Future: promote subsets into `searchFilters` schema |

## Placeholder / unused items

- **FilterBar “More Filters”** (pre–2.2): button had no handler — now opens verified + property type on `/search`.
- **Lifestyle filter**: no structured field; users rely on keyword search.
- **Featured filter**: homepage curated band only; not exposed on `/search`.
- **Commercial/Land toggles**: folded into property type substring matching.

## Sprint 2.2 refactors applied

1. Created `src/lib/searchFilters.js` — single parse/build/apply/sort/chip pipeline for `/search`.
2. Wired `FilterBar` on search results with URL sync, chips, reset, debounced keyword, Enter to search.
3. Fixed district **Verified only** to use `isListingCardVerified()` (`verification_status`).
4. `HomeAdvancedFiltersModal` uses `buildSearchRouterQuery()` for consistent handoff.

## Recommended next steps (not in 2.2 scope)

- Promote district advanced filters into optional `/search` URL keys or shared `DiscoveryFilterSchema`.
- Server-side filtered Supabase query via `discoveryExtensionPoints.registerDiscoveryQueryBuilder`.
- Unify `market` vs `status` query param naming across search and district routes.
- Extend `savedSearchUtils` to persist full `SearchFilterState`.
