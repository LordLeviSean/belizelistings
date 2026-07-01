-- BelizeListings — Phase 4.0 profile contact fields, completion, public contact RPC.
-- Rollback: drop RPC + columns (additive only; safe to leave columns empty).

-- ---------------------------------------------------------------------------
-- profiles — contact + privacy + completion
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS brokerage_name text,
  ADD COLUMN IF NOT EXISTS brokerage_phone text,
  ADD COLUMN IF NOT EXISTS contact_email_display text,
  ADD COLUMN IF NOT EXISTS show_email_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_phone_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.phone IS
  'Required for profile completion before listing submit-for-review.';
COMMENT ON COLUMN public.profiles.whatsapp IS
  'Optional WhatsApp number; falls back to phone in public contact when unset.';
COMMENT ON COLUMN public.profiles.contact_email_display IS
  'Optional public-facing email override; auth email remains canonical.';

-- Backfill completion timestamp for rows that already have phone
UPDATE public.profiles
SET profile_completed_at = COALESCE(profile_completed_at, updated_at, created_at, timezone('utc'::text, now()))
WHERE profile_completed_at IS NULL
  AND phone IS NOT NULL
  AND length(trim(phone)) >= 7;

-- ---------------------------------------------------------------------------
-- RPC — public listing owner contact (respects privacy flags)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_listing_owner_public_contact(p_listing_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner uuid;
  v_row public.profiles%ROWTYPE;
  v_email text;
  v_phone text;
  v_whatsapp text;
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT l.user_id INTO v_owner
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND (
      COALESCE(l.status, '') IN ('approved', 'published')
      OR COALESCE(l.lifecycle_status, '') IN ('approved', 'published')
      OR COALESCE(l.moderation_status, '') IN ('approved', 'published')
    )
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM public.profiles WHERE id = v_owner;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_email := NULL;
  IF COALESCE(v_row.show_email_public, true) THEN
    v_email := NULLIF(trim(COALESCE(v_row.contact_email_display, v_row.email, '')), '');
  END IF;

  v_phone := NULL;
  IF COALESCE(v_row.show_phone_public, true) THEN
    v_phone := NULLIF(trim(COALESCE(v_row.phone, '')), '');
  END IF;

  v_whatsapp := NULLIF(trim(COALESCE(v_row.whatsapp, '')), '');
  IF v_whatsapp IS NULL AND v_phone IS NOT NULL THEN
    v_whatsapp := v_phone;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_owner,
    'username', v_row.username,
    'display_name', COALESCE(
      NULLIF(trim(v_row.username), ''),
      NULLIF(split_part(COALESCE(v_row.email, ''), '@', 1), ''),
      'Your listing agent'
    ),
    'brokerage_name', NULLIF(trim(COALESCE(v_row.brokerage_name, '')), ''),
    'brokerage_phone', NULLIF(trim(COALESCE(v_row.brokerage_phone, '')), ''),
    'phone', v_phone,
    'whatsapp', v_whatsapp,
    'email', v_email,
    'show_email_public', COALESCE(v_row.show_email_public, true),
    'show_phone_public', COALESCE(v_row.show_phone_public, true)
  );
END;
$$;

COMMENT ON FUNCTION public.get_listing_owner_public_contact IS
  'Returns privacy-respecting owner contact for a publicly visible listing.';

REVOKE ALL ON FUNCTION public.get_listing_owner_public_contact FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_owner_public_contact TO anon;
GRANT EXECUTE ON FUNCTION public.get_listing_owner_public_contact TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_owner_public_contact TO service_role;
