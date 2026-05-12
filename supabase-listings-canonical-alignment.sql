-- =============================================================================
-- BelizeListings — listings table canonical alignment (single consolidated migration)
-- Safe-first: additive ALTER for existing databases; no property_id column added.
-- Run in Supabase SQL editor or Supabase CLI migrations after backup.
-- PostgREST: notify reload schema if columns were missing from cache.
-- =============================================================================
--
-- SECTION A — GREENFIELD REFERENCE ONLY (do not run on a DB that already has `listings`)
-- -----------------------------------------------------------------------------
-- Use this when bootstrapping a fresh environment; adjust PK type if your project
-- standard differs (this repo uses uuid consistently with profiles/units scripts).
--
-- CREATE TABLE public.listings (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--
--   -- Ownership & attribution (production)
--   user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--   listed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   managed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--
--   -- Core inventory (production)
--   title text NOT NULL DEFAULT '',
--   price numeric(14,2) NOT NULL DEFAULT 0,
--   currency text NOT NULL DEFAULT 'BZD',
--   property_type text NOT NULL DEFAULT '',
--   district text NOT NULL DEFAULT '',
--   region_slug text,
--   subregion_slug text,
--   listing_type text NOT NULL DEFAULT 'sale',
--   beds integer NOT NULL DEFAULT 0,
--   baths numeric(6,2) NOT NULL DEFAULT 0,
--   garage integer NOT NULL DEFAULT 0,
--   square_feet numeric(14,2),
--   description text,
--   amenities text[],
--   features text,
--
--   -- Operator / unit linkage (production; property_id intentionally omitted)
--   unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
--
--   -- Lifecycle & moderation (production)
--   status text NOT NULL DEFAULT 'draft',
--   lifecycle_status text,
--   moderation_status text,
--   review_status text,
--
--   reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   moderated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--   deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
--
--   published_at timestamptz,
--   verified_at timestamptz,
--   archived_at timestamptz,
--   rented_at timestamptz,
--   sold_at timestamptz,
--   expired_at timestamptz,
--   deleted_at timestamptz,
--   reviewed_at timestamptz,
--   last_reviewed_at timestamptz,
--   occupied_at timestamptz,
--   vacated_at timestamptz,
--
--   occupancy_status text,
--   vacancy_status text,
--   maintenance_hold boolean NOT NULL DEFAULT false,
--   seasonal_hold boolean NOT NULL DEFAULT false,
--
--   verification_status text,
--   moderation_notes text,
--   rejection_reason text,
--   resubmission_notes text,
--
--   -- Timestamps (production; client sets ISO strings; DB defaults for resilience)
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now(),
--
--   -- Optional / enrichment (future-facing; nullable)
--   market_type text,
--   category text,
--   listing_category text,
--   inventory_verification_status text,
--   closing_verification_status text,
--   agency_name text,
--   brokerage_name text,
--   closed_at timestamptz,
--   approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_listings_user_id ON public.listings(user_id);
-- CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
-- CREATE INDEX IF NOT EXISTS idx_listings_lifecycle_status ON public.listings(lifecycle_status);
-- CREATE INDEX IF NOT EXISTS idx_listings_moderation_status ON public.listings(moderation_status);
-- CREATE INDEX IF NOT EXISTS idx_listings_region_slug ON public.listings(region_slug);
-- CREATE INDEX IF NOT EXISTS idx_listings_unit_id ON public.listings(unit_id);
-- CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON public.listings(updated_at DESC);
--
-- =============================================================================
-- SECTION B — ADDITIVE CHANGES FOR EXISTING DATABASES (safe to run)
-- =============================================================================

-- Core inventory & copy
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BZD',
  ADD COLUMN IF NOT EXISTS garage integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_type text DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS property_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS district text DEFAULT '',
  ADD COLUMN IF NOT EXISTS beds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baths numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS square_feet numeric,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amenities text[],
  ADD COLUMN IF NOT EXISTS features text;

COMMENT ON COLUMN public.listings.currency IS 'Display and filtering currency; create flow defaults to BZD.';
COMMENT ON COLUMN public.listings.garage IS 'Parking capacity; create flow pins to 0 until UI expands.';
COMMENT ON COLUMN public.listings.listing_type IS 'sale | rent and related modes; drives browse and operator rental flows.';
COMMENT ON COLUMN public.listings.property_type IS 'Structural category (house, land, commercial, …).';
COMMENT ON COLUMN public.listings.district IS 'Primary geography slug for legacy filters and cards.';
COMMENT ON COLUMN public.listings.beds IS 'Bedroom count for residential inventory.';
COMMENT ON COLUMN public.listings.baths IS 'Bathroom count; numeric to allow half-baths.';
COMMENT ON COLUMN public.listings.square_feet IS 'Optional floor area for intel and cards.';
COMMENT ON COLUMN public.listings.description IS 'Long-form body copy for detail pages and search haystack.';
COMMENT ON COLUMN public.listings.amenities IS 'Canonical structured amenity tags; preferred over legacy CSV.';
COMMENT ON COLUMN public.listings.features IS 'Legacy CSV line derived from amenities + freeform tail for backward-compatible readers.';

-- Geography refinement (homepage / district pages)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS region_slug text,
  ADD COLUMN IF NOT EXISTS subregion_slug text;

COMMENT ON COLUMN public.listings.region_slug IS 'District-level slug when listing is tied to a parent region.';
COMMENT ON COLUMN public.listings.subregion_slug IS 'Finer geography when selection is a subregion of a district.';

-- Dual-track lifecycle (canonicalListing + admin queues)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS moderation_status text,
  ADD COLUMN IF NOT EXISTS review_status text;

COMMENT ON COLUMN public.listings.lifecycle_status IS 'Operational bucket aligned with UI lifecycle resolution.';
COMMENT ON COLUMN public.listings.moderation_status IS 'Queue state (pending_review, approved, rejected, archived, draft, …).';
COMMENT ON COLUMN public.listings.review_status IS 'Legacy moderation alias; readers fall back when moderation_status absent.';

-- Ownership actors (profiles FKs match existing step6 / agent scripts)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listed_by uuid,
  ADD COLUMN IF NOT EXISTS managed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

COMMENT ON COLUMN public.listings.listed_by IS 'Profile id for original listing author attribution.';
COMMENT ON COLUMN public.listings.managed_by IS 'Profile id for ongoing steward / manager attribution.';
COMMENT ON COLUMN public.listings.reviewed_by IS 'Last moderator who completed a review pass.';
COMMENT ON COLUMN public.listings.moderated_by IS 'Actor who applied the last moderation transition.';
COMMENT ON COLUMN public.listings.published_by IS 'Actor who approved/published to public inventory.';
COMMENT ON COLUMN public.listings.verified_by IS 'Actor who ran inventory verification.';
COMMENT ON COLUMN public.listings.archived_by IS 'Actor who archived the row.';
COMMENT ON COLUMN public.listings.closed_by IS 'Reserved for terminal close actions (rented/sold close paths).';
COMMENT ON COLUMN public.listings.deleted_by IS 'Actor stamp before hard delete in permanent-delete flow.';

-- Event timestamps
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS rented_at timestamptz,
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS occupied_at timestamptz,
  ADD COLUMN IF NOT EXISTS vacated_at timestamptz;

COMMENT ON COLUMN public.listings.published_at IS 'When the listing became publicly visible.';
COMMENT ON COLUMN public.listings.verified_at IS 'When verification workflow stamped the row.';
COMMENT ON COLUMN public.listings.archived_at IS 'When the listing left active rotation.';
COMMENT ON COLUMN public.listings.rented_at IS 'Transaction timestamp for rental closes.';
COMMENT ON COLUMN public.listings.sold_at IS 'Transaction timestamp for sale closes.';
COMMENT ON COLUMN public.listings.expired_at IS 'Planned sunset / expiry for stale inventory intelligence.';
COMMENT ON COLUMN public.listings.deleted_at IS 'Soft stamp before physical delete (optional).';
COMMENT ON COLUMN public.listings.reviewed_at IS 'Last successful review completion instant.';
COMMENT ON COLUMN public.listings.last_reviewed_at IS 'Reject path moderation timestamp without implying approval.';
COMMENT ON COLUMN public.listings.occupied_at IS 'Operator occupancy intelligence anchor.';
COMMENT ON COLUMN public.listings.vacated_at IS 'Operator vacancy intelligence anchor.';

-- Occupancy flags (operator / trust signals)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS occupancy_status text,
  ADD COLUMN IF NOT EXISTS vacancy_status text,
  ADD COLUMN IF NOT EXISTS maintenance_hold boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS seasonal_hold boolean DEFAULT false;

COMMENT ON COLUMN public.listings.occupancy_status IS 'Structured occupancy signal for dashboards.';
COMMENT ON COLUMN public.listings.vacancy_status IS 'Paired vacancy signal for multi-unit operations.';
COMMENT ON COLUMN public.listings.maintenance_hold IS 'Suppress marketing while maintenance in progress.';
COMMENT ON COLUMN public.listings.seasonal_hold IS 'Suppress marketing for seasonal inventory pauses.';

-- Trust & moderation copy
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS moderation_notes text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS resubmission_notes text;

COMMENT ON COLUMN public.listings.verification_status IS 'Listing-level verification marker used by trust strips.';
COMMENT ON COLUMN public.listings.moderation_notes IS 'Internal moderator notes; not shown on public cards.';
COMMENT ON COLUMN public.listings.rejection_reason IS 'Structured/text reason from moderation.';
COMMENT ON COLUMN public.listings.resubmission_notes IS 'Agent notes when resubmitting after rejection.';

-- Unit linkage (operator property/workspace architecture)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS unit_id uuid;

COMMENT ON COLUMN public.listings.unit_id IS 'Links a listing to internal units inventory; ON DELETE behavior enforced via FK block below.';

-- Row timestamps (preserve semantics; only add if missing)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.listings.created_at IS 'Row creation time; drives ordering across dashboards.';
COMMENT ON COLUMN public.listings.updated_at IS 'Last mutation time; autosave + lifecycle updates refresh this.';

-- Future-facing optional enrichment (read by presentation/trust when present)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS market_type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS listing_category text,
  ADD COLUMN IF NOT EXISTS inventory_verification_status text,
  ADD COLUMN IF NOT EXISTS closing_verification_status text,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS brokerage_name text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

COMMENT ON COLUMN public.listings.market_type IS 'Optional marketplace subtype for land/commercial detection.';
COMMENT ON COLUMN public.listings.category IS 'Optional taxonomy bucket alongside property_type.';
COMMENT ON COLUMN public.listings.listing_category IS 'Alternate category dimension used by presentation helpers.';
COMMENT ON COLUMN public.listings.inventory_verification_status IS 'Secondary verification flag for trust fallbacks.';
COMMENT ON COLUMN public.listings.closing_verification_status IS 'Closing-specific verification for rented/sold analytics.';
COMMENT ON COLUMN public.listings.agency_name IS 'Denormalized broker/agency label for operational snapshots.';
COMMENT ON COLUMN public.listings.brokerage_name IS 'Denormalized brokerage label for broker dashboards.';
COMMENT ON COLUMN public.listings.closed_at IS 'Explicit close timestamp when distinct from rented_at/sold_at.';
COMMENT ON COLUMN public.listings.approved_by IS 'Legacy alias for published_by resolution in ownership snapshots.';

-- -----------------------------------------------------------------------------
-- Foreign keys (only when parent tables exist — matches repo scripts)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'listings_listed_by_fkey'
    ) THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_listed_by_fkey FOREIGN KEY (listed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_managed_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_managed_by_fkey FOREIGN KEY (managed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_reviewed_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_moderated_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_published_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_verified_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_archived_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_closed_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_deleted_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_approved_by_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.units') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_unit_id_fkey') THEN
      ALTER TABLE public.listings
        ADD CONSTRAINT listings_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfill helper transforms (idempotent)
-- -----------------------------------------------------------------------------
UPDATE public.listings
SET lifecycle_status = coalesce(lifecycle_status, status)
WHERE lifecycle_status IS NULL AND status IS NOT NULL;

UPDATE public.listings
SET moderation_status = coalesce(
  moderation_status,
  CASE
    WHEN status = 'pending' THEN 'pending_review'
    WHEN status = 'approved' THEN 'approved'
    WHEN status = 'rejected' THEN 'rejected'
    WHEN status = 'archived' THEN 'archived'
    WHEN status = 'draft' THEN 'draft'
    ELSE NULL
  END
)
WHERE moderation_status IS NULL;

UPDATE public.listings
SET listed_by = coalesce(listed_by, user_id)
WHERE listed_by IS NULL AND user_id IS NOT NULL;

UPDATE public.listings
SET managed_by = coalesce(managed_by, user_id)
WHERE managed_by IS NULL AND user_id IS NOT NULL;

UPDATE public.listings
SET region_slug = coalesce(region_slug, district)
WHERE region_slug IS NULL AND district IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Indexes (match admin/browse filters)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_listings_lifecycle_status ON public.listings(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_listings_moderation_status ON public.listings(moderation_status);
CREATE INDEX IF NOT EXISTS idx_listings_region_slug ON public.listings(region_slug);
CREATE INDEX IF NOT EXISTS idx_listings_subregion_slug ON public.listings(subregion_slug);
CREATE INDEX IF NOT EXISTS idx_listings_archived_at ON public.listings(archived_at);
CREATE INDEX IF NOT EXISTS idx_listings_deleted_at ON public.listings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_listings_user_id_status ON public.listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_unit_id ON public.listings(unit_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON public.listings(updated_at DESC);

-- =============================================================================
-- SECTION C — ARCHITECTURE NOTES (frontend audit 2026-05-08)
-- =============================================================================
-- A) Columns the frontend writes or relies on that were commonly MISSING before
--    additive patches (supabaseCompat strip-retry paths): lifecycle_status,
--    moderation_status, region_slug, subregion_slug, listed_by, managed_by,
--    published/review/moderation actor ids, event timestamps (published_at,
--    verified_at, archived_at, rented_at, sold_at, expired_at, deleted_at,
--    reviewed_at, last_reviewed_at), occupancy + hold flags, verification_status,
--    moderation_notes, rejection_reason, resubmission_notes, unit_id,
--    currency, garage, features, square_feet, amenities, description.
--
-- B) Supabase columns NO LONGER used by frontend mutation paths (legacy):
--    property_id — intentionally stripped in listingPayloadSanitize / persistence;
--    agent_id — migration script supabase-listings-migrate-to-user-id.sql drops it
--    after user_id backfill (ManageUsersPanel still tolerates agent_id in SELECT
--    fallbacks only if the column exists).
--
-- C) Normalization candidates (keep columns for now; split later):
--    - Event/staff stamps → listing_audit_events (approve/reject/archive/verify).
--    - moderation_notes + rejection_reason + resubmission_notes → moderation_thread.
--    - Dual geography (district + region_slug + subregion_slug) → geography FK.
--    - features CSV → derive from amenities + optional freeform table.
--    - agency_name / brokerage_name → join brokerages / profiles only.
-- =============================================================================
