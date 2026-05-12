-- BelizeListings — additive profiles.username (run in Supabase SQL editor).
-- Safe for existing auth: column is nullable; legacy rows remain valid until backfilled.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

COMMENT ON COLUMN public.profiles.username IS
  'Public handle for dashboards and admin identity. Stored lowercase; unique when set.';

-- One non-null username per value (app normalizes to lowercase before insert).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username)
  WHERE username IS NOT NULL AND btrim(username) <> '';

-- Optional: speed lookups by handle
CREATE INDEX IF NOT EXISTS profiles_username_lookup
  ON public.profiles (username)
  WHERE username IS NOT NULL;
