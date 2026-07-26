-- Align archive processor with public visibility closed-timestamp resolver.
-- Fixes limbo: listings hidden from browse (updated_at fallback) but never archived by RPC.

CREATE OR REPLACE FUNCTION public.get_listing_closed_at(
  p_closed_at timestamptz,
  p_sold_at timestamptz,
  p_rented_at timestamptz,
  p_updated_at timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_closed_at, p_sold_at, p_rented_at, p_updated_at);
$$;

COMMENT ON FUNCTION public.get_listing_closed_at IS
  'Canonical closed timestamp: closed_at → sold_at → rented_at → updated_at (legacy fallback).';

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
    AND public.get_listing_closed_at(p_closed_at, p_sold_at, p_rented_at, p_updated_at) IS NOT NULL
    AND public.get_listing_closed_at(p_closed_at, p_sold_at, p_rented_at, p_updated_at)
      > (p_now - (public.get_listing_closed_archive_minutes() || ' minutes')::interval);
$$;

CREATE OR REPLACE FUNCTION public.archive_expired_closed_listings(
  p_archive_after_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived integer := 0;
  v_notifications integer := 0;
  v_eligible integer := 0;
  v_row record;
  v_minutes integer := COALESCE(p_archive_after_minutes, public.get_listing_closed_archive_minutes());
  v_cutoff timestamptz;
BEGIN
  IF NOT public.is_service_role_context() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_minutes IS NULL OR v_minutes < 1 THEN
    v_minutes := 2880;
  END IF;

  v_cutoff := timezone('utc'::text, now()) - (v_minutes || ' minutes')::interval;

  UPDATE public.platform_runtime_config
  SET config_value = v_minutes::text,
      updated_at = timezone('utc'::text, now())
  WHERE config_key = 'listing_closed_archive_minutes';

  SELECT COUNT(*)::integer INTO v_eligible
  FROM public.listings
  WHERE lower(COALESCE(lifecycle_status, '')) IN ('recently_sold', 'recently_rented')
    AND lower(COALESCE(status, '')) <> 'archived'
    AND public.get_listing_closed_at(closed_at, sold_at, rented_at, updated_at) IS NOT NULL
    AND public.get_listing_closed_at(closed_at, sold_at, rented_at, updated_at) <= v_cutoff;

  FOR v_row IN
    SELECT id, user_id, title, lifecycle_status
    FROM public.listings
    WHERE lower(COALESCE(lifecycle_status, '')) IN ('recently_sold', 'recently_rented')
      AND lower(COALESCE(status, '')) <> 'archived'
      AND public.get_listing_closed_at(closed_at, sold_at, rented_at, updated_at) IS NOT NULL
      AND public.get_listing_closed_at(closed_at, sold_at, rented_at, updated_at) <= v_cutoff
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings
    SET
      status = 'archived',
      moderation_status = 'archived',
      lifecycle_status = 'archived',
      archived_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    WHERE id = v_row.id
      AND lower(COALESCE(status, '')) <> 'archived';

    IF FOUND THEN
      v_archived := v_archived + 1;

      PERFORM public.enqueue_notification_event(
        'listing_auto_archived',
        v_row.user_id,
        jsonb_build_object(
          'listing_id', v_row.id,
          'listing_title', v_row.title,
          'lifecycle_status', v_row.lifecycle_status,
          'dedupe_key', 'listing_auto_archived:' || v_row.id::text
        ),
        NULL
      );

      v_notifications := v_notifications + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'eligible', v_eligible,
    'archived', v_archived,
    'notificationsQueued', v_notifications,
    'archive_after_minutes', v_minutes,
    'ran_at', timezone('utc'::text, now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expired_closed_listings(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_expired_closed_listings(integer) TO service_role;

COMMENT ON FUNCTION public.archive_expired_closed_listings(integer) IS
  'Archives sold/rented listings after the canonical closed timestamp window; idempotent with deduped notifications.';
