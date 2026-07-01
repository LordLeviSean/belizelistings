-- BelizeListings — permanent delete for draft + archived listings (Phase 4.0.1)
--
-- Root cause: discardDraftListing used direct listings DELETE, which CASCADE hits
-- listing_events_deny_mutation without app.permanent_listing_delete bypass.
--
-- Single shared RPC for hard delete (draft or archived): favorites, listing_images,
-- listing_events (via bypass + CASCADE), CRM FK CASCADE, listing row — one transaction.

-- ---------------------------------------------------------------------------
-- permanently_delete_listing — draft OR archived hard delete
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.permanently_delete_listing(p_listing_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.listings%ROWTYPE;
  v_caller uuid;
  v_is_archived boolean;
  v_is_draft boolean;
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

  v_is_archived := (
    lower(coalesce(v_row.status::text, '')) = 'archived'
    OR lower(coalesce(v_row.lifecycle_status::text, '')) = 'archived'
    OR lower(coalesce(v_row.moderation_status::text, '')) = 'archived'
  );

  v_is_draft := (
    lower(coalesce(v_row.status::text, '')) = 'draft'
    OR lower(coalesce(v_row.lifecycle_status::text, '')) = 'draft'
    OR lower(coalesce(v_row.moderation_status::text, '')) = 'draft'
  );

  IF NOT (v_is_archived OR v_is_draft) THEN
    RAISE EXCEPTION 'permanent deletion is restricted to draft or archived listings';
  END IF;

  IF NOT (public.is_admin() OR v_row.user_id = v_caller) THEN
    RAISE EXCEPTION 'not authorized to permanently delete this listing';
  END IF;

  IF v_is_archived THEN
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
  END IF;

  PERFORM set_config('app.permanent_listing_delete', '1', true);
  PERFORM public._permanently_delete_listing_row(p_listing_id);
END;
$$;

COMMENT ON FUNCTION public.permanently_delete_listing(bigint) IS
  'Hard-delete a draft or archived listing (favorites, listing_images, listing_events bypass, listing row). Owner or admin only.';

REVOKE ALL ON FUNCTION public.permanently_delete_listing(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_listing(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_listing(bigint) TO service_role;

-- ---------------------------------------------------------------------------
-- permanently_delete_archived_listing — backward-compatible wrapper (archived only)
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
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.listings
  WHERE id = p_listing_id;

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

  PERFORM public.permanently_delete_listing(p_listing_id);
END;
$$;

COMMENT ON FUNCTION public.permanently_delete_archived_listing(bigint) IS
  'Backward-compatible wrapper: hard-delete an archived listing via permanently_delete_listing.';

REVOKE ALL ON FUNCTION public.permanently_delete_archived_listing(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_listing(bigint) TO service_role;
