# BelizeListings V1.0 — Platform Workflow Audit

*Generated with v3 geography pass. Production geography not implemented.*

| Platform Area | Current Behavior | V1.0 Required Change | Risk | Files / Tables | Implementation Phase |
| ------------- | ---------------- | -------------------- | ---- | -------------- | -------------------- |
| Create Listing — draft | Flat `district` label select from `getSelectableRegions()` | 3-level: District → City/Town/Village → Locality; highway+mile optional | High | `create.jsx`, `listingPersistence.js` | Phase 3 (post–Open Beta) |
| Create Listing — autosave | Writes `district`, `region_slug`, `subregion_slug` | Add `community_id`, `locality_id`, optional `highway_id`+`mile` | High | `listingPersistence.js`, `draftListingInsertContract.js` | Phase 3 |
| Create Listing — validation | Slug must be in `getSelectableRegions()` | Parent-scoped community validation | High | `create.jsx:1224` | Phase 3 |
| Create Listing — mobile | Single select | Cascading selects + mile input | Med | `create.jsx`, mobile CSS | Phase 4 |
| Edit Listing — owner/agent | Same flat district | Same 3-level + migration compat | High | `create.jsx`, dashboard panels | Phase 3 |
| Edit Listing — admin/operator | `REGION_OPTIONS` flat | Scoped community picker | Med | `AllListingsPanel.jsx`, `OperatorListingsPanel.jsx` | Phase 4 |
| Edit Listing — rejected resubmit | Uses `create.jsx` flow | Compat layer for legacy slugs | Med | `listingPersistence.js` | Phase 3 |
| Existing listings — migration | `district`/`region_slug`/`subregion_slug` only | Map to `community_id`; `locality_id` null until backfill | High | SQL backfill script, `legacyDraftCompat.js` | Phase 5 |
| Existing listings — San Pedro disambiguation | Global slug `san-pedro` | Scope by `map_region_id` + parent | **Critical** | `geographyLayer.js`, compat layer | Phase 2 |
| Existing listings — Santa Elena | Same slug risk Cayo/Toledo | Parent-scoped IDs | **Critical** | Seed v3, compat layer | Phase 2 |
| Existing listings — Independence/Mango Creek | Not supported | Alias both → `area-stann-creek-independence` | Med | Compat aliases | Phase 2 |
| Display — listing cards | `getRegionLabel(district)` | Format: locality, community, district | Med | `ListingCard.jsx`, `canonicalListing.js` | Phase 4 |
| Display — listing detail | Region label + caption | Full hierarchy string | Med | `listing/[id].js` | Phase 4 |
| Display — dashboards | Raw district slug/label | Scoped community labels | Med | `UserMyListingsPanel.jsx`, agent panels | Phase 4 |
| Display — CRM/inbox | Listing title + district text | Hierarchy in thread context | Low | CRM panels | Phase 5 |
| Search/filters — top level | URL `?district=` slug | Map region or admin district | High | `searchFilters.js`, `filterListings.js` | Phase 4 |
| Search/filters — locality | Not supported | Optional locality + highway filters | High | `filterListings.js` | Phase 5 |
| Search/filters — aliases | `normalizeRegionSlug` via `bySlug` | Parent-scoped alias index | High | `geographyLayer.js` → DB | Phase 2 |
| Search/filters — legacy URLs | `/listings/district/{slug}` | 301/compat for new Area routes | Med | `[district].jsx`, `districtExploreRoutes.js` | Phase 4 |
| Map — 8 regions | Click → district slug route | Unchanged; optional community drill-down later | Low | `BelizeMap.jsx`, `belizeMapRegions.js` | Phase 6 |
| Map — highways | Not shown | Optional corridor overlay; no polygons required | Low | Map layer future | Phase 6+ |
| SEO/routes | District pages only | Area/locality pages optional; avoid thin duplicates | Med | `siteMetadata.js`, new routes | Phase 5 |
| Operator properties | Free-text `district` | Optional link to geography (later) | Low | `PropertiesPanel.jsx` | Phase 6+ |
| Tests | Flat slug assumptions | Parent-scoped fixtures | Med | `*.test.js` across repo | Phase 2–5 |
| DB | No geo tables | `geo_regions`, `geo_communities`, `geo_localities`, `geo_highways`, junctions | High | New migrations (not yet) | Phase 1 (post–Open Beta) |
