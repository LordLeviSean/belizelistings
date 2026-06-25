-- BelizeListings — append-only listing_events (Phase 3 Milestone 3.1)
--
-- Property timeline foundation: immutable event log; listings row remains materialized state.
-- Requires public.is_admin() from profiles_admin_rls migrations.

CREATE TABLE IF NOT EXISTS public.listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'internal')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'app'
    CHECK (source IN ('app', 'admin', 'system', 'migration_backfill')),
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.listing_events IS
  'Append-only listing activity log. Current state remains on listings row.';

CREATE INDEX IF NOT EXISTS listing_events_listing_occurred_idx
  ON public.listing_events (listing_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS listing_events_type_idx
  ON public.listing_events (event_type);

CREATE INDEX IF NOT EXISTS listing_events_created_at_idx
  ON public.listing_events (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS listing_events_correlation_unique
  ON public.listing_events (listing_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Immutability: no updates or deletes on event rows
CREATE OR REPLACE FUNCTION public.listing_events_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'listing_events is append-only; % is not permitted', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS listing_events_deny_update ON public.listing_events;
CREATE TRIGGER listing_events_deny_update
  BEFORE UPDATE ON public.listing_events
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_events_deny_mutation();

DROP TRIGGER IF EXISTS listing_events_deny_delete ON public.listing_events;
CREATE TRIGGER listing_events_deny_delete
  BEFORE DELETE ON public.listing_events
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_events_deny_mutation();

ALTER TABLE public.listing_events ENABLE ROW LEVEL SECURITY;

-- Public read: public events on publicly visible listings
DROP POLICY IF EXISTS "listing_events_select_public" ON public.listing_events;
CREATE POLICY "listing_events_select_public"
  ON public.listing_events
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND COALESCE(l.status, l.lifecycle_status, '') IN ('approved', 'published')
    )
  );

-- Owner read: all events on own listings (includes internal)
DROP POLICY IF EXISTS "listing_events_select_owner" ON public.listing_events;
CREATE POLICY "listing_events_select_owner"
  ON public.listing_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND l.user_id = auth.uid()
    )
  );

-- Admin read: all events
DROP POLICY IF EXISTS "listing_events_select_admin" ON public.listing_events;
CREATE POLICY "listing_events_select_admin"
  ON public.listing_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No direct INSERT/UPDATE/DELETE for clients — use append_listing_event RPC

CREATE OR REPLACE FUNCTION public.append_listing_event(
  p_listing_id uuid,
  p_event_type text,
  p_visibility text DEFAULT 'public',
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_source text DEFAULT 'app',
  p_correlation_id uuid DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_event_id uuid;
  v_occurred_at timestamptz;
  v_caller uuid;
BEGIN
  IF p_listing_id IS NULL OR COALESCE(trim(p_event_type), '') = '' THEN
    RAISE EXCEPTION 'listing_id and event_type are required';
  END IF;

  IF p_visibility NOT IN ('public', 'internal') THEN
    RAISE EXCEPTION 'invalid visibility: %', p_visibility;
  END IF;

  IF p_source NOT IN ('app', 'admin', 'system', 'migration_backfill') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;

  v_caller := auth.uid();

  IF p_source = 'migration_backfill' THEN
    IF v_caller IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'migration_backfill source requires admin or service role';
    END IF;
  ELSE
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'authentication required';
    END IF;

    IF NOT (
      public.is_admin()
      OR p_actor_id = v_caller
      OR EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = p_listing_id AND l.user_id = v_caller
      )
    ) THEN
      RAISE EXCEPTION 'not authorized to append listing event';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = p_listing_id) THEN
    RAISE EXCEPTION 'listing not found: %', p_listing_id;
  END IF;

  IF p_correlation_id IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM public.listing_events
    WHERE listing_id = p_listing_id AND correlation_id = p_correlation_id
    LIMIT 1;

    IF v_event_id IS NOT NULL THEN
      RETURN v_event_id;
    END IF;
  END IF;

  v_occurred_at := COALESCE(p_occurred_at, timezone('utc'::text, now()));

  INSERT INTO public.listing_events (
    listing_id,
    event_type,
    visibility,
    actor_id,
    actor_role,
    occurred_at,
    payload,
    source,
    correlation_id
  ) VALUES (
    p_listing_id,
    trim(p_event_type),
    p_visibility,
    p_actor_id,
    p_actor_role,
    v_occurred_at,
    COALESCE(p_payload, '{}'::jsonb),
    p_source,
    p_correlation_id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.append_listing_event IS
  'Single authorized entry point for listing_events INSERT. Idempotent when correlation_id provided.';

REVOKE ALL ON FUNCTION public.append_listing_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_listing_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_listing_event TO service_role;

-- Atomic verification update + event append (admin-only)
CREATE OR REPLACE FUNCTION public.apply_listing_verification_with_event(
  p_listing_id uuid,
  p_verified boolean,
  p_admin_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_prev_verified_at timestamptz;
  v_prev_verified_by uuid;
  v_now timestamptz;
  v_event_type text;
  v_visibility text;
  v_payload jsonb;
  v_event_id uuid;
  v_listing jsonb;
BEGIN
  IF p_listing_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'listing_id and admin_user_id are required';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_admin() OR auth.uid() <> p_admin_user_id THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;

  SELECT verified_at, verified_by
  INTO v_prev_verified_at, v_prev_verified_by
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing not found: %', p_listing_id;
  END IF;

  v_now := timezone('utc'::text, now());

  IF p_verified THEN
    UPDATE public.listings
    SET
      verification_status = 'verified',
      verified_at = v_now,
      verified_by = p_admin_user_id
    WHERE id = p_listing_id;

    v_event_type := 'listing.verification.approved';
    v_visibility := 'public';
    v_payload := jsonb_build_object(
      'verification_status', 'verified',
      'verified_at', v_now,
      'verified_by', p_admin_user_id
    );
  ELSE
    UPDATE public.listings
    SET
      verification_status = 'unverified',
      verified_at = NULL,
      verified_by = NULL
    WHERE id = p_listing_id;

    v_event_type := 'listing.verification.removed';
    v_visibility := 'internal';
    v_payload := jsonb_build_object(
      'verification_status', 'unverified',
      'previous_verified_at', v_prev_verified_at,
      'previous_verified_by', v_prev_verified_by
    );
  END IF;

  v_event_id := public.append_listing_event(
    p_listing_id,
    v_event_type,
    v_visibility,
    v_payload,
    p_admin_user_id,
    'admin',
    'admin',
    gen_random_uuid(),
    v_now
  );

  SELECT jsonb_build_object(
    'id', l.id,
    'verification_status', l.verification_status,
    'verified_at', l.verified_at,
    'verified_by', l.verified_by,
    'event_id', v_event_id
  )
  INTO v_listing
  FROM public.listings l
  WHERE l.id = p_listing_id;

  RETURN v_listing;
END;
$$;

COMMENT ON FUNCTION public.apply_listing_verification_with_event IS
  'Admin-only atomic verification PATCH + listing_events append.';

REVOKE ALL ON FUNCTION public.apply_listing_verification_with_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_listing_verification_with_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_listing_verification_with_event TO service_role;
