-- BelizeListings — profiles trigger + RLS hardening (Supabase / Postgres).
--
-- Intent (Dashboard / SQL editor operators):
-- 1) public.handle_new_user: AFTER INSERT on auth.users remains the CANONICAL creator of
--    public.profiles rows. SECURITY DEFINER + owner postgres bypasses RLS on INSERT.
-- 2) RLS on public.profiles: authenticated users may SELECT/INSERT/UPDATE only their own row
--    (id = auth.uid()). The trigger does not need these policies. Service role bypasses RLS.
-- 3) Defaults: optional updated_at for client insert compatibility.
--
-- Apply with `supabase db push` or paste into the SQL editor after public.profiles exists.

-- ---------------------------------------------------------------------------
-- Column defaults (additive; safe if column already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles
  ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());

-- ---------------------------------------------------------------------------
-- Trigger function: prefer full row (with username). ON CONFLICT (id) DO NOTHING
-- handles idempotent replays. Username unique collisions fall back to row without username.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  uname text;
  v_created_at timestamptz;
BEGIN
  meta := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(btrim(COALESCE(meta->>'username', '')));
  IF uname = '' THEN
    uname := NULL;
  END IF;

  v_created_at := COALESCE(new.created_at, timezone('utc'::text, now()));

  BEGIN
    INSERT INTO public.profiles (id, email, role, username, created_at)
    VALUES (new.id, new.email, 'user', uname, v_created_at)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, email, role, created_at)
      VALUES (new.id, new.email, 'user', v_created_at)
      ON CONFLICT (id) DO NOTHING;
  END;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = new.id) THEN
    RETURN new;
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'AFTER INSERT on auth.users: ensures public.profiles row (RLS-safe). Username from raw_user_meta_data; on username collision inserts without username for app repair.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS: own-row read/write for JWT-authenticated clients; trigger bypasses RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
