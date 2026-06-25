-- BelizeListings — listing verification_status + public agent directory (Phase 2 Sprint 2.0)
--
-- 1) verification_status on listings with owner-role backfill and insert default
-- 2) Public SELECT on agent/broker profiles for guest directory browsing

-- ---------------------------------------------------------------------------
-- Listing verification_status
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS verification_status text;

COMMENT ON COLUMN public.listings.verification_status IS
  'Listing-level verification marker for card badges; admin-overridable.';

UPDATE public.listings AS l
SET verification_status = CASE
  WHEN lower(coalesce(p.role, '')) IN ('agent', 'broker', 'admin') THEN 'verified'
  ELSE 'unverified'
END
FROM public.profiles AS p
WHERE p.id = l.user_id
  AND (l.verification_status IS NULL OR btrim(l.verification_status) = '');

UPDATE public.listings
SET verification_status = 'unverified'
WHERE verification_status IS NULL OR btrim(verification_status) = '';

ALTER TABLE public.listings
  ALTER COLUMN verification_status SET DEFAULT 'unverified';

CREATE OR REPLACE FUNCTION public.set_listing_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_role text;
BEGIN
  IF NEW.verification_status IS NOT NULL AND btrim(NEW.verification_status) <> '' THEN
    RETURN NEW;
  END IF;

  owner_role := NULL;
  IF NEW.user_id IS NOT NULL THEN
    SELECT lower(coalesce(role, ''))
    INTO owner_role
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  IF owner_role IN ('agent', 'broker', 'admin') THEN
    NEW.verification_status := 'verified';
  ELSE
    NEW.verification_status := 'unverified';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_listing_verification_status() IS
  'BEFORE INSERT on listings: default verification_status from owner profile role when unset.';

DROP TRIGGER IF EXISTS listings_set_verification_status ON public.listings;

CREATE TRIGGER listings_set_verification_status
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_listing_verification_status();

-- ---------------------------------------------------------------------------
-- Public agent directory — guest-readable agent/broker profiles with username
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_public_agents" ON public.profiles;

CREATE POLICY "profiles_select_public_agents"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    lower(coalesce(role, '')) IN ('agent', 'broker')
    AND username IS NOT NULL
    AND btrim(username) <> ''
  );

GRANT SELECT ON TABLE public.profiles TO anon;
