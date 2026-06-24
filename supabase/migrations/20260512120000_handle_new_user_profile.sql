-- BelizeListings — auto-create public.profiles on auth.users insert (Supabase handle_new_user pattern).
-- Superseded / extended by `20260512140000_profiles_rls_and_trigger_hardening.sql` (RLS + trigger refinements).
--
-- RLS / trigger interaction:
--   Client-side INSERT into public.profiles often fails when email confirmation is ON: signUp returns
--   a user row but no session/JWT yet, so PostgREST acts as anon and typical policies
--   (auth.uid() = profiles.id) block INSERT/SELECT. A SECURITY DEFINER trigger on auth.users runs
--   as the function owner (postgres), bypasses RLS, and guarantees a profile row at signup time.
--   Frontend ensureProfile remains for username enrichment, email updates, and repair after sign-in.
--
-- Assumptions (align with app + supabase-migration-profiles-username.sql):
--   public.profiles has: id uuid PRIMARY KEY, email text, role text, optional username text,
--   created_at timestamptz default now(). If your table lacks created_at or username, remove those
--   columns from the INSERTs below (or add columns) before applying.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  uname text;
BEGIN
  meta := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(btrim(COALESCE(meta->>'username', '')));
  IF uname = '' THEN
    uname := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, role, username, created_at)
    VALUES (
      new.id,
      new.email,
      'user',
      uname,
      COALESCE(new.created_at, timezone('utc'::text, now()))
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Username already taken by another profile: still create the row without username; app can repair.
      INSERT INTO public.profiles (id, email, role, created_at)
      VALUES (
        new.id,
        new.email,
        'user',
        COALESCE(new.created_at, timezone('utc'::text, now()))
      )
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'AFTER INSERT on auth.users: creates public.profiles (RLS-safe). Username from raw_user_meta_data; role user.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
