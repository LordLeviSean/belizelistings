-- BelizeListings — per-listing owner metrics (views, saves, inquiries) + detail view tracking.
-- Rollback: drop RPCs + listing_detail_views (additive).

-- ---------------------------------------------------------------------------
-- listing_detail_views — legitimate detail-page views (deduped per viewer_key)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.listing_detail_views (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  viewer_user_id uuid,
  viewer_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS listing_detail_views_listing_idx
  ON public.listing_detail_views (listing_id);

CREATE UNIQUE INDEX IF NOT EXISTS listing_detail_views_dedupe_idx
  ON public.listing_detail_views (listing_id, viewer_key);

COMMENT ON TABLE public.listing_detail_views IS
  'Deduped listing detail page views; owner self-views excluded via record_listing_detail_view RPC.';

ALTER TABLE public.listing_detail_views ENABLE ROW LEVEL SECURITY;

-- No direct client writes — RPC only.

-- ---------------------------------------------------------------------------
-- record_listing_detail_view — append view (exclude listing owner / admin self-views)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_listing_detail_view(
  p_listing_id bigint,
  p_viewer_user_id uuid DEFAULT NULL,
  p_viewer_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner uuid;
  v_key text;
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN;
  END IF;

  v_key := NULLIF(trim(COALESCE(p_viewer_key, '')), '');
  IF v_key IS NULL AND p_viewer_user_id IS NOT NULL THEN
    v_key := 'user:' || p_viewer_user_id::text;
  END IF;
  IF v_key IS NULL THEN
    RETURN;
  END IF;

  SELECT l.user_id INTO v_owner
  FROM public.listings l
  WHERE l.id = p_listing_id
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  IF p_viewer_user_id IS NOT NULL AND p_viewer_user_id = v_owner THEN
    RETURN;
  END IF;

  INSERT INTO public.listing_detail_views (listing_id, viewer_user_id, viewer_key)
  VALUES (p_listing_id, p_viewer_user_id, v_key)
  ON CONFLICT (listing_id, viewer_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.record_listing_detail_view IS
  'Record a deduped listing detail view; skips owner self-views.';

REVOKE ALL ON FUNCTION public.record_listing_detail_view FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_listing_detail_view TO anon;
GRANT EXECUTE ON FUNCTION public.record_listing_detail_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_listing_detail_view TO service_role;

-- ---------------------------------------------------------------------------
-- get_owner_listing_metrics — batch counts for dashboard listing cards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_owner_listing_metrics(p_listing_ids bigint[])
RETURNS TABLE (
  listing_id bigint,
  views bigint,
  saves bigint,
  inquiries bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS listing_id,
    COALESCE(v.cnt, 0)::bigint AS views,
    COALESCE(f.cnt, 0)::bigint AS saves,
    COALESCE(i.cnt, 0)::bigint AS inquiries
  FROM public.listings l
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS cnt
    FROM public.listing_detail_views dv
    WHERE dv.listing_id = l.id
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT fav.user_id)::bigint AS cnt
    FROM public.favorites fav
    WHERE fav.listing_id = l.id
  ) f ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS cnt
    FROM public.listing_inquiries li
    WHERE li.listing_id = l.id
      AND COALESCE(li.inquiry_type, 'general') <> 'schedule_viewing'
  ) i ON true
  WHERE l.id = ANY (COALESCE(p_listing_ids, ARRAY[]::bigint[]))
    AND (
      l.user_id = v_uid
      OR public.is_admin()
    );
END;
$$;

COMMENT ON FUNCTION public.get_owner_listing_metrics IS
  'Owner-scoped views, unique favorite saves, and non-viewing inquiry counts per listing.';

REVOKE ALL ON FUNCTION public.get_owner_listing_metrics FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_listing_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_listing_metrics TO service_role;
