-- BelizeListings — permanent admin user delete (Phase 3.8 / 3.8.1)
--
-- Mirrors permanently_delete_archived_listing: SECURITY DEFINER, row_security off,
-- listing_events bypass via app.permanent_listing_delete, audit row before profile removal.
-- Auth identity is removed via API route (service role) after RPC returns storage paths.
--
-- Phase 3.8.1: shared listing row helper, audit metadata counts, DRY listing cleanup.

-- ---------------------------------------------------------------------------
-- _permanently_delete_listing_row — internal listing hard-delete (no auth gate)
-- Caller must set app.permanent_listing_delete = '1' before invoking.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._permanently_delete_listing_row(p_listing_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;

  DELETE FROM public.favorites f
  WHERE f.listing_id::text = p_listing_id::text;

  DELETE FROM public.listing_images li
  WHERE li.listing_id = p_listing_id;

  DELETE FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing delete failed: %', p_listing_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public._permanently_delete_listing_row(bigint) IS
  'Internal helper: hard-delete favorites, listing_images, and listing row. Requires app.permanent_listing_delete.';

REVOKE ALL ON FUNCTION public._permanently_delete_listing_row(bigint) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- permanently_delete_archived_listing — delegate listing cleanup to shared helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_listing(p_listing_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.listings%ROWTYPE;
  v_caller uuid;
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;

  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing not found: %', p_listing_id;
  END IF;

  IF NOT (
    lower(coalesce(v_row.status::text, '')) = 'archived'
    OR lower(coalesce(v_row.lifecycle_status::text, '')) = 'archived'
    OR lower(coalesce(v_row.moderation_status::text, '')) = 'archived'
  ) THEN
    RAISE EXCEPTION 'permanent deletion is restricted to archived listings';
  END IF;

  IF NOT (public.is_admin() OR v_row.user_id = v_caller) THEN
    RAISE EXCEPTION 'not authorized to permanently delete this listing';
  END IF;

  BEGIN
    UPDATE public.listings
    SET
      deleted_by = v_caller,
      deleted_at = timezone('utc'::text, now())
    WHERE id = p_listing_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  PERFORM set_config('app.permanent_listing_delete', '1', true);
  PERFORM public._permanently_delete_listing_row(p_listing_id);
END;
$$;

COMMENT ON FUNCTION public.permanently_delete_archived_listing(bigint) IS
  'Hard-delete an archived listing (favorites, listing_images, listing row). Admin or listing owner only.';

REVOKE ALL ON FUNCTION public.permanently_delete_archived_listing(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO service_role;

-- ---------------------------------------------------------------------------
-- admin_user_deletion_audit — persists after profile/auth row is gone
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_user_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  deleted_user_email text,
  deleted_user_username text,
  admin_id uuid NOT NULL,
  reason text,
  deleted_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.admin_user_deletion_audit IS
  'Append-only audit of admin-initiated permanent user deletion. Inserts via permanently_delete_user RPC only.';

CREATE INDEX IF NOT EXISTS admin_user_deletion_audit_deleted_at_idx
  ON public.admin_user_deletion_audit (deleted_at DESC);

CREATE INDEX IF NOT EXISTS admin_user_deletion_audit_deleted_user_idx
  ON public.admin_user_deletion_audit (deleted_user_id);

ALTER TABLE public.admin_user_deletion_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_user_deletion_audit_select_admin" ON public.admin_user_deletion_audit;
CREATE POLICY "admin_user_deletion_audit_select_admin"
  ON public.admin_user_deletion_audit
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for clients — RPC writes with row_security off.

-- ---------------------------------------------------------------------------
-- permanently_delete_user — hard-delete user-owned public data + profile
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.permanently_delete_user(
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_profile public.profiles%ROWTYPE;
  v_listing_id bigint;
  v_listings_deleted int := 0;
  v_inquiries_deleted int := 0;
  v_conversations_deleted int := 0;
  v_viewings_deleted int := 0;
  v_notifications_deleted int := 0;
  v_agent_requests_deleted int := 0;
  v_upgrade_requests_deleted int := 0;
  v_image_urls jsonb := '[]'::jsonb;
  v_row_count int := 0;
  v_has_agent_id boolean := false;
  v_audit_listings int := 0;
  v_audit_images int := 0;
  v_audit_favorites int := 0;
  v_audit_notifications int := 0;
  v_audit_conversations int := 0;
  v_audit_messages int := 0;
  v_audit_viewing_requests int := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;

  IF v_caller = p_user_id THEN
    RAISE EXCEPTION 'cannot permanently delete your own account';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found: %', p_user_id;
  END IF;

  IF lower(coalesce(v_profile.role, '')) = 'admin' THEN
    RAISE EXCEPTION 'cannot permanently delete another admin account';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'listings'
      AND c.column_name = 'agent_id'
  )
  INTO v_has_agent_id;

  -- Count related records BEFORE delete for audit metadata.
  IF v_has_agent_id THEN
    SELECT count(*)
    INTO v_audit_listings
    FROM public.listings l
    WHERE l.user_id = p_user_id OR l.agent_id = p_user_id;

    SELECT count(*)
    INTO v_audit_images
    FROM public.listing_images li
    WHERE li.listing_id IN (
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id OR l.agent_id = p_user_id
    );

    SELECT count(*)
    INTO v_audit_favorites
    FROM public.favorites f
    WHERE f.user_id = p_user_id
       OR f.listing_id::text IN (
         SELECT l.id::text
         FROM public.listings l
         WHERE l.user_id = p_user_id OR l.agent_id = p_user_id
       );
  ELSE
    SELECT count(*)
    INTO v_audit_listings
    FROM public.listings l
    WHERE l.user_id = p_user_id;

    SELECT count(*)
    INTO v_audit_images
    FROM public.listing_images li
    WHERE li.listing_id IN (
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id
    );

    SELECT count(*)
    INTO v_audit_favorites
    FROM public.favorites f
    WHERE f.user_id = p_user_id
       OR f.listing_id::text IN (
         SELECT l.id::text
         FROM public.listings l
         WHERE l.user_id = p_user_id
       );
  END IF;

  SELECT count(*)
  INTO v_audit_notifications
  FROM public.notifications
  WHERE recipient_user_id = p_user_id;

  SELECT count(*)
  INTO v_audit_conversations
  FROM public.conversations
  WHERE agent_id = p_user_id OR buyer_id = p_user_id;

  SELECT count(*)
  INTO v_audit_messages
  FROM public.messages m
  WHERE EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = m.conversation_id
      AND (c.agent_id = p_user_id OR c.buyer_id = p_user_id)
  );

  SELECT count(*)
  INTO v_audit_viewing_requests
  FROM public.viewing_requests
  WHERE agent_user_id = p_user_id
     OR requester_id = p_user_id
     OR confirmed_by = p_user_id;

  -- Collect listing image URLs for client-side storage cleanup (before row deletes).
  IF v_has_agent_id THEN
    SELECT coalesce(jsonb_agg(to_jsonb(li.image_url)), '[]'::jsonb)
    INTO v_image_urls
    FROM public.listing_images li
    WHERE li.listing_id IN (
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id OR l.agent_id = p_user_id
    );
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(li.image_url)), '[]'::jsonb)
    INTO v_image_urls
    FROM public.listing_images li
    WHERE li.listing_id IN (
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id
    );
  END IF;

  INSERT INTO public.admin_user_deletion_audit (
    deleted_user_id,
    deleted_user_email,
    deleted_user_username,
    admin_id,
    reason,
    metadata
  ) VALUES (
    p_user_id,
    v_profile.email,
    v_profile.username,
    v_caller,
    NULLIF(trim(p_reason), ''),
    jsonb_build_object(
      'profile_role', coalesce(v_profile.role, 'user'),
      'initiated_at', timezone('utc'::text, now()),
      'listings', v_audit_listings,
      'images', v_audit_images,
      'favorites', v_audit_favorites,
      'notifications', v_audit_notifications,
      'conversations', v_audit_conversations,
      'messages', v_audit_messages,
      'viewing_requests', v_audit_viewing_requests
    )
  );

  PERFORM set_config('app.permanent_listing_delete', '1', true);

  -- Hard-delete every listing owned or attributed to this user (any status).
  IF v_has_agent_id THEN
    FOR v_listing_id IN
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id OR l.agent_id = p_user_id
      ORDER BY l.id
    LOOP
      PERFORM public._permanently_delete_listing_row(v_listing_id);
      v_listings_deleted := v_listings_deleted + 1;
    END LOOP;
  ELSE
    FOR v_listing_id IN
      SELECT l.id
      FROM public.listings l
      WHERE l.user_id = p_user_id
      ORDER BY l.id
    LOOP
      PERFORM public._permanently_delete_listing_row(v_listing_id);
      v_listings_deleted := v_listings_deleted + 1;
    END LOOP;
  END IF;

  DELETE FROM public.favorites
  WHERE user_id = p_user_id;

  -- CRM / messaging remnants where user participated on others' listings.
  DELETE FROM public.messages m
  WHERE EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = m.conversation_id
      AND (c.agent_id = p_user_id OR c.buyer_id = p_user_id)
  );

  DELETE FROM public.conversations
  WHERE agent_id = p_user_id OR buyer_id = p_user_id;
  GET DIAGNOSTICS v_conversations_deleted = ROW_COUNT;

  DELETE FROM public.listing_inquiries
  WHERE agent_user_id = p_user_id
     OR listing_owner_id = p_user_id
     OR sender_id = p_user_id
     OR sender_user_id = p_user_id;
  GET DIAGNOSTICS v_inquiries_deleted = ROW_COUNT;

  DELETE FROM public.viewing_requests
  WHERE agent_user_id = p_user_id
     OR requester_id = p_user_id
     OR confirmed_by = p_user_id;
  GET DIAGNOSTICS v_viewings_deleted = ROW_COUNT;

  DELETE FROM public.notification_queue
  WHERE recipient_id = p_user_id;

  DELETE FROM public.notifications
  WHERE recipient_user_id = p_user_id;
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  IF to_regclass('public.agent_requests') IS NOT NULL THEN
    DELETE FROM public.agent_requests
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_agent_requests_deleted = ROW_COUNT;
  END IF;

  UPDATE public.agent_upgrade_requests
  SET reviewed_by = NULL
  WHERE reviewed_by = p_user_id;

  DELETE FROM public.agent_upgrade_requests
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_upgrade_requests_deleted = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile delete failed: %', p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_user_id', p_user_id,
    'image_urls', coalesce(v_image_urls, '[]'::jsonb),
    'metadata', jsonb_build_object(
      'listings', v_audit_listings,
      'images', v_audit_images,
      'favorites', v_audit_favorites,
      'notifications', v_audit_notifications,
      'conversations', v_audit_conversations,
      'messages', v_audit_messages,
      'viewing_requests', v_audit_viewing_requests,
      'listings_deleted', v_listings_deleted,
      'favorites_deleted', v_audit_favorites,
      'conversations_deleted', v_conversations_deleted,
      'inquiries_deleted', v_inquiries_deleted,
      'viewings_deleted', v_viewings_deleted,
      'notifications_deleted', v_notifications_deleted,
      'agent_requests_deleted', v_agent_requests_deleted,
      'upgrade_requests_deleted', v_upgrade_requests_deleted
    )
  );
END;
$$;

COMMENT ON FUNCTION public.permanently_delete_user(uuid, text) IS
  'Admin-only hard delete of a non-admin user: listings, CRM rows, favorites, profile. Auth user removed via service-role API.';

REVOKE ALL ON FUNCTION public.permanently_delete_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_user(uuid, text) TO service_role;
