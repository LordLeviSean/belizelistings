-- BelizeListings: structured amenity tags for inventory (create flow + future detail/filter).
-- Run after analytics/backups; refresh PostgREST schema cache if needed.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS amenities TEXT[];

COMMENT ON COLUMN public.listings.amenities IS 'Canonical amenity labels; legacy `features` may still hold CSV for older readers.';
