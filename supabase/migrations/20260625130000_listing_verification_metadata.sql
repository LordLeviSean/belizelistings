-- BelizeListings — listing verification metadata (Phase 2 Sprint 2.1)
--
-- Adds verified_at / verified_by for admin verification audit trail.
-- Admin updates via existing "Admins full access" listings RLS policy.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

COMMENT ON COLUMN public.listings.verified_at IS
  'When an admin (or workflow) stamped listing verification; cleared on revoke.';

COMMENT ON COLUMN public.listings.verified_by IS
  'Profile id of admin who verified the listing; cleared on revoke.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_verified_by_fkey'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_verified_by_fkey
      FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
