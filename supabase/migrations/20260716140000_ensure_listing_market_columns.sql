-- Ensure optional market columns exist (additive only — no ownership/status changes).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_type text DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS market_type text,
  ADD COLUMN IF NOT EXISTS property_type text DEFAULT '';

COMMENT ON COLUMN public.listings.listing_type IS 'sale | rent and related modes; drives browse and operator rental flows.';
COMMENT ON COLUMN public.listings.market_type IS 'Optional marketplace subtype for land/commercial detection.';
COMMENT ON COLUMN public.listings.property_type IS 'Structural category (house, land, commercial, …).';
