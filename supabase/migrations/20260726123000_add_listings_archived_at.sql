-- Production listings table may predate archived_at; archive RPC requires the column.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.listings.archived_at IS 'When the listing left active rotation.';

CREATE INDEX IF NOT EXISTS idx_listings_archived_at ON public.listings(archived_at);
