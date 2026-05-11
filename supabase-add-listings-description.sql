-- BelizeListings: nullable listing copy for detail pages (editorial body text).
-- Run in Supabase SQL editor or via migration pipeline, then refresh PostgREST schema cache if needed.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.listings.description IS 'Optional long-form description; shown only on listing detail pages.';
