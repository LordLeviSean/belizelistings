# Step 6 Backend Synchronization Plan

## Current storage audit (from code + existing SQL scripts)

- **`listings`**
  - Present in use: `id`, `title`, `price`, `district`, `listing_type`, `property_type`, `beds`, `baths`, `garage`, `currency`, `status`, `user_id`, `created_at`, `updated_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `property_id`, `unit_id`
  - Used by runtime but not guaranteed in DB yet: ownership columns (`listed_by`, `managed_by`, `archived_by`, etc.), lifecycle timestamp columns (`published_at`, `verified_at`, ...)
  - Current semantic mismatch: legacy `status` stores both lifecycle and moderation
- **`profiles`**
  - Present in use: `id`, `role`, `email`, `full_name`, optional verification/brokerage metadata
  - Needs expansion consistency for verification and brokerage relation fields
- **`favorites`**
  - Present in use: `id`, `user_id`, `listing_id`, timestamps (indirect)
  - Relationship is stable and must be preserved across lifecycle/deletion actions
- **`listing_images`**
  - Present in use: `listing_id`, `image_url`, `position`
  - Must remain linked for create/delete lifecycle flows

## Missing/target-aligned fields (additive migration)

- Lifecycle canonical: `lifecycle_status`, `moderation_status`
- Lifecycle timestamps: `published_at`, `verified_at`, `archived_at`, `rented_at`, `sold_at`, `expired_at`, `deleted_at`
- Ownership attribution: `listed_by`, `managed_by`, `verified_by`, `archived_by`, `closed_by`, `moderated_by`, `reviewed_by`, `published_by`, `deleted_by`
- Geography alignment: `region_slug`, `subregion_slug`
- Vacancy prep: `occupancy_status`, `vacancy_status`, `occupied_at`, `vacated_at`, `maintenance_hold`, `seasonal_hold`
- Moderation history prep: `moderation_notes` (lightweight placeholder)

## Safe migration order (incremental)

1. Run additive schema migration (`supabase-step6-additive-sync.sql`)
2. Validate RLS compatibility for new writable columns on `listings`
3. Deploy frontend payload synchronization (done in this phase)
4. Monitor writes and remove now-unneeded column-stripping fallbacks only after schema stability confirms
5. Add dedicated moderation event table in Step 6.1 if required

## Risks + mitigations

- **RLS blocks update/insert with new columns** -> keep safe fallback strip logic temporarily
- **Missing columns in production variants** -> additive migration is idempotent with `if not exists`
- **Semantic drift (`status` vs lifecycle/moderation)** -> dual-write strategy keeps legacy reads stable
- **Downtime risk** -> no destructive drops in this phase

## Step 6 immediate outcome

- Migration-ready canonical fields are defined
- Create flow writes lifecycle + ownership + geography + vacancy-prep metadata (with safe fallback)
- Existing operational flows remain compatible while backend catches up
