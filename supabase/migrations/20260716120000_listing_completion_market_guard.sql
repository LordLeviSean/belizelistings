-- Enforce sale/rent market alignment when owners mark listings sold or rented.

CREATE OR REPLACE FUNCTION public.listing_row_market_kind(
  p_listing_type text,
  p_market_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(replace(trim(coalesce(p_listing_type, '')), '_', '-')) IN ('rent', 'rental', 'lease') THEN 'rent'
    WHEN lower(replace(trim(coalesce(p_listing_type, '')), '_', '-')) IN ('sale', 'sell', 'for-sale', 'forsale') THEN 'sale'
    WHEN lower(replace(trim(coalesce(p_market_type, '')), '_', '-')) IN ('rent', 'rental', 'lease') THEN 'rent'
    WHEN lower(replace(trim(coalesce(p_market_type, '')), '_', '-')) IN ('sale', 'for-sale', 'forsale') THEN 'sale'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.listing_row_market_kind IS
  'Canonical sale/rent kind from listing_type (primary) and market_type (secondary).';

CREATE OR REPLACE FUNCTION public.enforce_listing_owner_moderation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old_lc text;
  v_new_lc text;
  v_market text;
BEGIN
  IF public.is_admin() OR public.is_service_role_context() THEN
    RETURN NEW;
  END IF;

  IF v_caller IS NULL OR v_caller IS DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'ownership_immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.listed_by IS DISTINCT FROM OLD.listed_by
     OR NEW.managed_by IS DISTINCT FROM OLD.managed_by
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
    RAISE EXCEPTION 'attribution_immutable' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.verification_status, '') = 'verified'
     AND COALESCE(OLD.verification_status, '') IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'owner_cannot_self_verify' USING ERRCODE = '42501';
  END IF;

  v_old_lc := public.listing_effective_lifecycle_key(OLD.status, OLD.lifecycle_status, OLD.moderation_status);
  v_new_lc := public.listing_effective_lifecycle_key(NEW.status, NEW.lifecycle_status, NEW.moderation_status);

  IF v_old_lc = 'approved'
     AND v_new_lc IN ('recently_sold', 'recently_rented') THEN
    v_market := public.listing_row_market_kind(OLD.listing_type, OLD.market_type);
    IF v_market IS NULL THEN
      RAISE EXCEPTION 'completion_market_unknown' USING ERRCODE = '23514';
    END IF;
    IF v_new_lc = 'recently_sold' AND v_market <> 'sale' THEN
      RAISE EXCEPTION 'completion_market_mismatch' USING ERRCODE = '23514';
    END IF;
    IF v_new_lc = 'recently_rented' AND v_market <> 'rent' THEN
      RAISE EXCEPTION 'completion_market_mismatch' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF v_new_lc = 'pending'
     AND v_old_lc IN ('draft', 'rejected', 'archived', 'pending') THEN
    RETURN NEW;
  END IF;

  IF v_old_lc IN ('approved', 'recently_sold', 'recently_rented')
     AND v_new_lc = v_old_lc THEN
    RETURN NEW;
  END IF;

  IF v_old_lc IN ('draft', 'rejected', 'archived')
     AND v_new_lc IN ('draft', 'rejected', 'archived') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.moderation_status, '') = 'approved'
     AND COALESCE(OLD.moderation_status, '') IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'owner_cannot_self_approve' USING ERRCODE = '42501';
  END IF;

  IF (
    COALESCE(NEW.status, '') IN ('approved', 'published')
    OR COALESCE(NEW.lifecycle_status, '') IN ('approved', 'published')
  ) AND v_old_lc NOT IN ('approved', 'recently_sold', 'recently_rented') THEN
    RAISE EXCEPTION 'owner_cannot_self_approve' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
