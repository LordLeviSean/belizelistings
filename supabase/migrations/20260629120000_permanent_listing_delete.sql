-- BelizeListings — permanent delete for archived listings (Phase 3.7)
--
-- Root causes addressed:
--   1. listing_events_deny_delete blocks CASCADE when deleting listings
--   2. favorites RLS only allows users to delete own rows
--   3. listing_images owner-only RLS can block admin delete
--
-- Requires public.is_admin() from profiles_admin_rls migrations.

-- Allow CASCADE delete of listing_events during authorized permanent listing delete.
CREATE OR REPLACE FUNCTION public.listing_events_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.permanent_listing_delete', true) = '1' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'listing_events is append-only; % is not permitted', TG_OP;
END;
$$;

COMMENT ON FUNCTION public.listing_events_deny_mutation() IS
  'Blocks listing_events mutation except CASCADE DELETE during permanently_delete_archived_listing.';

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

COMMENT ON FUNCTION public.permanently_delete_archived_listing(bigint) IS
  'Hard-delete an archived listing (favorites, listing_images, listing row). Admin or listing owner only.';

REVOKE ALL ON FUNCTION public.permanently_delete_archived_listing(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO service_role;

-- Align listings admin policy with hardened is_admin() (case-insensitive role).
DROP POLICY IF EXISTS "Admins full access" ON public.listings;
CREATE POLICY "Admins full access"
  ON public.listings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
