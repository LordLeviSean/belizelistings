-- Configurable closed-listing archive window (default 48h / 2880 minutes).
-- JS cron syncs listing_closed_archive_minutes from LISTING_CLOSED_ARCHIVE_MINUTES env.

DROP FUNCTION IF EXISTS public.archive_expired_closed_listings();

CREATE TABLE IF NOT EXISTS public.platform_runtime_config (
  config_key text PRIMARY KEY,
  config_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.platform_runtime_config (config_key, config_value)
VALUES ('listing_closed_archive_minutes', '2880')
ON CONFLICT (config_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_listing_closed_archive_minutes()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      (SELECT config_value FROM public.platform_runtime_config WHERE config_key = 'listing_closed_archive_minutes'),
      ''
    )::integer,
    2880
  );
$$;

CREATE OR REPLACE FUNCTION public.is_listing_recently_closed_public(
  p_status text,
  p_lifecycle_status text,
  p_sold_at timestamptz,
  p_rented_at timestamptz,
  p_closed_at timestamptz,
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
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at) IS NOT NULL
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at)
      > (p_now - (public.get_listing_closed_archive_minutes() || ' minutes')::interval);
$$;

COMMENT ON FUNCTION public.is_listing_recently_closed_public IS
  'Public browse window for sold/rented listings during the configured post-close period.';

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
  v_row record;
  v_minutes integer := COALESCE(p_archive_after_minutes, public.get_listing_closed_archive_minutes());
BEGIN
  IF NOT public.is_service_role_context() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_minutes IS NULL OR v_minutes < 1 THEN
    v_minutes := 2880;
  END IF;

  UPDATE public.platform_runtime_config
  SET config_value = v_minutes::text,
      updated_at = timezone('utc'::text, now())
  WHERE config_key = 'listing_closed_archive_minutes';

  FOR v_row IN
    SELECT id, user_id, title, lifecycle_status, closed_at
    FROM public.listings
    WHERE lower(COALESCE(lifecycle_status, '')) IN ('recently_sold', 'recently_rented')
      AND lower(COALESCE(status, '')) <> 'archived'
      AND COALESCE(closed_at, sold_at, rented_at) IS NOT NULL
      AND COALESCE(closed_at, sold_at, rented_at)
        <= timezone('utc'::text, now()) - (v_minutes || ' minutes')::interval
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings
    SET
      status = 'archived',
      moderation_status = 'archived',
      updated_at = timezone('utc'::text, now())
    WHERE id = v_row.id;

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
  END LOOP;

  RETURN jsonb_build_object(
    'archived', v_archived,
    'skipped', 0,
    'archive_after_minutes', v_minutes,
    'ran_at', timezone('utc'::text, now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expired_closed_listings(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_expired_closed_listings(integer) TO service_role;

COMMENT ON FUNCTION public.archive_expired_closed_listings(integer) IS
  'Archives sold/rented listings after the configured closed_at window; preserves lifecycle outcome on lifecycle_status.';
