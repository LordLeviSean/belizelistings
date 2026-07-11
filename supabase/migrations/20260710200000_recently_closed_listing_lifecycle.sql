-- Recently sold / rented temporary public lifecycle (30-day display window).
-- Additive columns only; inquiry RPC already rejects non-published inventory.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS rented_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

COMMENT ON COLUMN public.listings.sold_at IS 'When listing entered recently_sold or sold lifecycle.';
COMMENT ON COLUMN public.listings.rented_at IS 'When listing entered recently_rented or rented lifecycle.';
COMMENT ON COLUMN public.listings.closed_at IS 'Canonical close timestamp for sold/rented transitions.';
COMMENT ON COLUMN public.listings.closed_by IS 'User who marked the listing sold or rented.';
