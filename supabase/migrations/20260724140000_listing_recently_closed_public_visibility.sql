-- Keep recently sold/rented listings publicly readable when close timestamps are absent.
-- Mirrors JS getListingClosedAt fallback (closed_at → sold_at → rented_at → updated_at).

DROP FUNCTION IF EXISTS public.is_listing_publicly_browsable(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
);

DROP FUNCTION IF EXISTS public.is_listing_recently_closed_public(
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.is_listing_recently_closed_public(
  p_status text,
  p_lifecycle_status text,
  p_sold_at timestamptz,
  p_rented_at timestamptz,
  p_closed_at timestamptz,
  p_updated_at timestamptz DEFAULT NULL,
  p_now timestamptz DEFAULT timezone('utc'::text, now())
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    lower(COALESCE(p_status, '')) <> 'archived'
    AND public.listing_effective_lifecycle_key(p_status, p_lifecycle_status, NULL)
      IN ('recently_sold', 'recently_rented')
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at, p_updated_at) IS NOT NULL
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at, p_updated_at)
      > (p_now - (public.get_listing_closed_archive_minutes() || ' minutes')::interval);
$$;

CREATE OR REPLACE FUNCTION public.is_listing_publicly_browsable(
  p_status text,
  p_lifecycle_status text,
  p_moderation_status text,
  p_sold_at timestamptz,
  p_rented_at timestamptz,
  p_closed_at timestamptz,
  p_updated_at timestamptz DEFAULT NULL,
  p_now timestamptz DEFAULT timezone('utc'::text, now())
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_listing_active_inventory(p_status, p_lifecycle_status, p_moderation_status)
    OR public.is_listing_recently_closed_public(
      p_status,
      p_lifecycle_status,
      p_sold_at,
      p_rented_at,
      p_closed_at,
      p_updated_at,
      p_now
    );
$$;

COMMENT ON FUNCTION public.is_listing_recently_closed_public IS
  'Public browse window for sold/rented listings; uses updated_at when close columns are missing.';

COMMENT ON FUNCTION public.is_listing_publicly_browsable IS
  'Public browse/search/detail visibility: active inventory OR recently closed within configured window.';

DROP POLICY IF EXISTS "Public can view browsable listings" ON public.listings;

CREATE POLICY "Public can view browsable listings"
  ON public.listings FOR SELECT
  TO anon, authenticated
  USING (
    public.is_listing_publicly_browsable(
      status,
      lifecycle_status,
      moderation_status,
      sold_at,
      rented_at,
      closed_at,
      updated_at
    )
  );
