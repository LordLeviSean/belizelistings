-- Cross-platform Web Push subscription foundation (Step 5A).
-- Stores browser PushSubscription endpoints per authenticated user/device.
-- No production push delivery wired in this migration.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  expiration_time timestamptz,
  platform_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  last_delivered_at timestamptz,
  last_failed_at timestamptz,
  consecutive_failures smallint NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  revoke_reason text,
  CONSTRAINT push_subscriptions_endpoint_nonempty CHECK (char_length(trim(endpoint)) > 0),
  CONSTRAINT push_subscriptions_p256dh_nonempty CHECK (char_length(trim(p256dh)) > 0),
  CONSTRAINT push_subscriptions_auth_secret_nonempty CHECK (char_length(trim(auth_secret)) > 0),
  CONSTRAINT push_subscriptions_platform_label_length CHECK (
    platform_label IS NULL OR char_length(platform_label) <= 32
  ),
  CONSTRAINT push_subscriptions_consecutive_failures_nonneg CHECK (consecutive_failures >= 0)
);

COMMENT ON TABLE public.push_subscriptions IS
  'Browser Web Push subscriptions — one row per device/PWA installation. Delivery uses service_role RPCs only.';

COMMENT ON COLUMN public.push_subscriptions.auth_secret IS
  'PushSubscription.keys.auth — stored separately from endpoint/p256dh for clarity.';

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_active_endpoint_uidx
  ON public.push_subscriptions (endpoint)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS push_subscriptions_delivery_idx
  ON public.push_subscriptions (user_id)
  WHERE is_active = true AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS — no direct client table access; RPC boundaries only
-- ---------------------------------------------------------------------------

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Clients register/revoke via SECURITY DEFINER RPCs returning minimal fields.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.push_subscription_endpoint_valid(p_endpoint text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_endpoint IS NOT NULL
    AND char_length(trim(p_endpoint)) BETWEEN 8 AND 2048
    AND trim(p_endpoint) ~* '^https://';
$$;

CREATE OR REPLACE FUNCTION public.push_subscription_key_valid(p_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_key IS NOT NULL AND char_length(trim(p_key)) BETWEEN 16 AND 512;
$$;

CREATE OR REPLACE FUNCTION public.touch_push_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_push_subscription_updated_at();

-- ---------------------------------------------------------------------------
-- register_push_subscription — authenticated upsert for caller device
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_expiration_time timestamptz DEFAULT NULL,
  p_platform_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid;
  v_subscription_id uuid;
  v_now timestamptz;
BEGIN
  v_user_id := auth.uid();
  v_now := timezone('utc'::text, now());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.push_subscription_endpoint_valid(p_endpoint) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_endpoint');
  END IF;

  IF NOT public.push_subscription_key_valid(p_p256dh)
     OR NOT public.push_subscription_key_valid(p_auth_secret) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_keys');
  END IF;

  -- Endpoint rotation / re-registration: deactivate prior rows for same endpoint owned by others.
  UPDATE public.push_subscriptions
  SET
    is_active = false,
    revoked_at = v_now,
    revoke_reason = 'endpoint_reassigned',
    updated_at = v_now
  WHERE endpoint = trim(p_endpoint)
    AND user_id <> v_user_id
    AND is_active = true;

  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_secret,
    expiration_time,
    platform_label,
    is_active,
    created_at,
    updated_at,
    consecutive_failures,
    revoked_at,
    revoke_reason
  ) VALUES (
    v_user_id,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth_secret),
    p_expiration_time,
    NULLIF(left(trim(COALESCE(p_platform_label, '')), 32), ''),
    true,
    v_now,
    v_now,
    0,
    NULL,
    NULL
  )
  ON CONFLICT (endpoint) WHERE is_active = true
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth_secret = EXCLUDED.auth_secret,
    expiration_time = EXCLUDED.expiration_time,
    platform_label = EXCLUDED.platform_label,
    is_active = true,
    updated_at = v_now,
    consecutive_failures = 0,
    revoked_at = NULL,
    revoke_reason = NULL,
    last_failed_at = NULL
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_subscription_id,
    'registered', true
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Rare race: fetch existing active row for caller and refresh keys.
    UPDATE public.push_subscriptions ps
    SET
      user_id = v_user_id,
      p256dh = trim(p_p256dh),
      auth_secret = trim(p_auth_secret),
      expiration_time = p_expiration_time,
      platform_label = NULLIF(left(trim(COALESCE(p_platform_label, '')), 32), ''),
      is_active = true,
      updated_at = v_now,
      consecutive_failures = 0,
      revoked_at = NULL,
      revoke_reason = NULL,
      last_failed_at = NULL
    WHERE ps.endpoint = trim(p_endpoint)
      AND ps.is_active = true
    RETURNING ps.id INTO v_subscription_id;

    RETURN jsonb_build_object(
      'ok', true,
      'subscription_id', v_subscription_id,
      'registered', true,
      'recovered', true
    );
END;
$$;

COMMENT ON FUNCTION public.register_push_subscription(text, text, text, timestamptz, text) IS
  'Upsert the caller''s Web Push subscription. Ownership derives from auth.uid(); endpoint/keys are not returned.';

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, timestamptz, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- revoke_push_subscription — authenticated device revoke (minimal result)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_push_subscription(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz;
  v_updated int;
BEGIN
  v_user_id := auth.uid();
  v_now := timezone('utc'::text, now());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_subscription_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_subscription');
  END IF;

  UPDATE public.push_subscriptions
  SET
    is_active = false,
    revoked_at = v_now,
    revoke_reason = 'user_revoked',
    updated_at = v_now
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND is_active = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_already_revoked');
  END IF;

  RETURN jsonb_build_object('ok', true, 'revoked', true, 'subscription_id', p_subscription_id);
END;
$$;

COMMENT ON FUNCTION public.revoke_push_subscription(uuid) IS
  'Revoke one push subscription owned by auth.uid(). Does not revoke other devices.';

REVOKE ALL ON FUNCTION public.revoke_push_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_push_subscription(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_my_push_subscription_devices — non-sensitive device inventory
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_my_push_subscription_devices()
RETURNS TABLE (
  subscription_id uuid,
  platform_label text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_delivered_at timestamptz,
  last_failed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.platform_label,
    ps.is_active,
    ps.created_at,
    ps.updated_at,
    ps.last_delivered_at,
    ps.last_failed_at
  FROM public.push_subscriptions ps
  WHERE ps.user_id = v_user_id
  ORDER BY ps.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.list_my_push_subscription_devices() IS
  'List caller device registrations without exposing endpoint or encryption keys.';

REVOKE ALL ON FUNCTION public.list_my_push_subscription_devices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_push_subscription_devices() TO authenticated;

-- ---------------------------------------------------------------------------
-- select_active_push_subscriptions_for_delivery — trusted server path only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.select_active_push_subscriptions_for_delivery(p_user_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  user_id uuid,
  endpoint text,
  p256dh text,
  auth_secret text,
  expiration_time timestamptz,
  platform_label text,
  consecutive_failures smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_service_role_context() THEN
    RAISE EXCEPTION 'push_delivery_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth_secret,
    ps.expiration_time,
    ps.platform_label,
    ps.consecutive_failures
  FROM public.push_subscriptions ps
  WHERE ps.user_id = p_user_id
    AND ps.is_active = true
    AND ps.revoked_at IS NULL
    AND (ps.expiration_time IS NULL OR ps.expiration_time > timezone('utc'::text, now()));
END;
$$;

COMMENT ON FUNCTION public.select_active_push_subscriptions_for_delivery(uuid) IS
  'Service-role delivery selector. Returns full subscription material for encryption/send.';

REVOKE ALL ON FUNCTION public.select_active_push_subscriptions_for_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_active_push_subscriptions_for_delivery(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- deactivate_push_subscription — permanent/temporary delivery lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deactivate_push_subscription(
  p_subscription_id uuid,
  p_reason text DEFAULT 'delivery_deactivated'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_now timestamptz;
  v_updated int;
BEGIN
  IF NOT public.is_service_role_context() THEN
    RAISE EXCEPTION 'push_delivery_forbidden' USING ERRCODE = '42501';
  END IF;

  v_now := timezone('utc'::text, now());

  UPDATE public.push_subscriptions
  SET
    is_active = false,
    revoked_at = v_now,
    revoke_reason = NULLIF(left(trim(COALESCE(p_reason, 'delivery_deactivated')), 128), ''),
    updated_at = v_now
  WHERE id = p_subscription_id
    AND is_active = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', v_updated > 0,
    'deactivated', v_updated > 0,
    'subscription_id', p_subscription_id
  );
END;
$$;

COMMENT ON FUNCTION public.deactivate_push_subscription(uuid, text) IS
  'Service-role deactivation after permanent endpoint failure or operational revoke.';

REVOKE ALL ON FUNCTION public.deactivate_push_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_push_subscription(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- record_push_subscription_delivery — success/failure counters (server only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_push_subscription_delivery(
  p_subscription_id uuid,
  p_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_now timestamptz;
  v_outcome text;
BEGIN
  IF NOT public.is_service_role_context() THEN
    RAISE EXCEPTION 'push_delivery_forbidden' USING ERRCODE = '42501';
  END IF;

  v_now := timezone('utc'::text, now());
  v_outcome := lower(trim(COALESCE(p_outcome, '')));

  IF v_outcome = 'success' THEN
    UPDATE public.push_subscriptions
    SET
      last_delivered_at = v_now,
      consecutive_failures = 0,
      updated_at = v_now
    WHERE id = p_subscription_id;
  ELSIF v_outcome = 'temporary_failure' THEN
    UPDATE public.push_subscriptions
    SET
      last_failed_at = v_now,
      consecutive_failures = LEAST(consecutive_failures + 1, 32767),
      updated_at = v_now
    WHERE id = p_subscription_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  RETURN jsonb_build_object('ok', true, 'subscription_id', p_subscription_id, 'outcome', v_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.record_push_subscription_delivery(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_push_subscription_delivery(uuid, text) TO service_role;
