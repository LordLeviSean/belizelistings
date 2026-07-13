-- BelizeListings — Listing geography V1 columns + profile modal marker
-- Additive only — legacy district/region_slug/subregion_slug preserved

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS map_region_slug text,
  ADD COLUMN IF NOT EXISTS community_id text,
  ADD COLUMN IF NOT EXISTS locality_id text,
  ADD COLUMN IF NOT EXISTS highway_id text,
  ADD COLUMN IF NOT EXISTS highway_mile numeric,
  ADD COLUMN IF NOT EXISTS locality_not_listed_text text,
  ADD COLUMN IF NOT EXISTS geo_backfill_status text,
  ADD COLUMN IF NOT EXISTS geo_migrated_at timestamptz;

COMMENT ON COLUMN public.listings.map_region_slug IS 'V1 map region slug (8 interactive regions).';
COMMENT ON COLUMN public.listings.community_id IS 'V1 geo_communities.id — city/town/village/road corridor.';
COMMENT ON COLUMN public.listings.locality_id IS 'V1 geo_localities.id — neighborhood/subdivision.';
COMMENT ON COLUMN public.listings.highway_id IS 'V1 geo_highways.id when property is on a highway mile.';
COMMENT ON COLUMN public.listings.highway_mile IS 'Validated mile marker tied to highway_id.';
COMMENT ON COLUMN public.listings.geo_backfill_status IS 'exact|partial|alias|ambiguous|unmatched|review_required';

CREATE INDEX IF NOT EXISTS idx_listings_map_region_slug ON public.listings (map_region_slug);
CREATE INDEX IF NOT EXISTS idx_listings_community_id ON public.listings (community_id);
CREATE INDEX IF NOT EXISTS idx_listings_locality_id ON public.listings (locality_id);
CREATE INDEX IF NOT EXISTS idx_listings_highway_id ON public.listings (highway_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS geographic_update_modal_seen_at timestamptz;

COMMENT ON COLUMN public.profiles.geographic_update_modal_seen_at IS
  'One-time Geographic Update V1.0 homepage modal dismissal timestamp.';
