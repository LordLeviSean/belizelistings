-- Align owner listing inquiry metrics with canonical Inbox conversations.
-- Inquiries = distinct conversations that appear in Inbox (not deleted/archived,
-- not schedule_viewing synthetics). Legacy orphan listing_inquiries rows are
-- preserved for audit but excluded from active KPI counts.

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
    SELECT COUNT(DISTINCT c.id)::bigint AS cnt
    FROM public.conversations c
    LEFT JOIN public.listing_inquiries li ON li.id = c.inquiry_id
    WHERE c.listing_id = l.id
      AND c.agent_deleted_at IS NULL
      AND c.agent_archived_at IS NULL
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
  'Owner-scoped views, unique favorite saves, and active Inbox inquiry conversation counts per listing.';

-- Backfill listing_inquiries.conversation_id when the conversation exists but the
-- reverse pointer was never written (does not delete any rows).
UPDATE public.listing_inquiries li
SET conversation_id = c.id,
    updated_at = COALESCE(li.updated_at, now())
FROM public.conversations c
WHERE c.inquiry_id = li.id
  AND li.conversation_id IS NULL;
