-- Backfill canonical market fields for legacy listings missing listing_type / market_type.

UPDATE public.listings
SET listing_type = 'sale'
WHERE listing_type IS NULL OR btrim(listing_type) = '';

UPDATE public.listings
SET market_type = CASE
  WHEN lower(replace(btrim(coalesce(listing_type, '')), '_', '-')) IN ('rent', 'rental', 'lease') THEN 'rent'
  ELSE 'sale'
END
WHERE market_type IS NULL OR btrim(market_type) = '';

COMMENT ON COLUMN public.listings.listing_type IS 'Canonical sale|rent market — drives completion actions and browse filters.';
COMMENT ON COLUMN public.listings.market_type IS 'Secondary market mirror of listing_type for legacy compatibility.';
