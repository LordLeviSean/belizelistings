# Belize Geography V1 — Seed Reconciliation Report

*Generated with production implementation — 2026-07-13*

## Source

- `docs/geography/belize-v1-location-seed.preview.v3.json` (John Smith Road → `verified_common_usage`, zero `requires_review`)
- Runtime module: `src/constants/belizeGeographyV1Data.js` (via `scripts/build-belize-geography-v1.mjs`)
- SQL seed: `supabase/migrations/20260713210000_belize_geography_v1_seed.sql`

## Expected totals (v3)

| Category | Expected |
|----------|---------:|
| Map regions | 8 |
| Communities | 232 |
| Localities | 107 |
| Highways | 5 |
| Road corridors | 20 |
| Aliases | 17+ |
| **Total records** | **387** |
| requires_review | **0** |

## Reconciliation

| Action | Count |
|--------|------:|
| Expected seed records | 387 |
| Insert strategy | `ON CONFLICT DO NOTHING` / `DO UPDATE` for map regions |
| Skipped (re-run safe) | idempotent |
| Duplicates prevented | `geo_communities(slug, map_region_id)`, parent-scoped `area_id` |
| John Smith Road | `road-john-smith-road` under `map-belize` only |

## Listing backfill

Run after migration: `SELECT * FROM public.backfill_listing_geography_v1();`

| Status | Meaning |
|--------|---------|
| exact | Legacy subregion mapped to community |
| partial | District/map region only |
| alias | Mango Creek → Independence |
| unmatched | No confident mapping |

Legacy columns `district`, `region_slug`, `subregion_slug` are preserved.

## Global notification

- RPC: `broadcast_geographic_update_v1()`
- Dedupe key: `geographic_update_v1:2026-07-13`
- Audience: users/agents/admins/operators with listings or listing-management role
