-- BelizeListings — idempotent profiles admin RLS + is_admin() hardening.
--
-- Why: remote projects may have missed 20260512180000, partial applies, or
-- function owner/search_path edge cases. This migration re-applies the same
-- policies and a hardened is_admin() (case-insensitive role, explicit owner).
--
-- Safe to re-run: DROP POLICY IF EXISTS + CREATE OR REPLACE FUNCTION.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND lower(trim(both FROM coalesce(p.role::text, ''))) = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when JWT subject has profiles.role = admin (case-insensitive); RLS helper. SECURITY DEFINER with row_security=off avoids RLS recursion.';

ALTER FUNCTION public.is_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- Table privileges (Supabase defaults usually include these; ensure client can
-- invoke policies on rows the policies allow.)
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_admin_all" ON public.profiles;
CREATE POLICY "profiles_select_admin_all"
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin_managed" ON public.profiles;
CREATE POLICY "profiles_update_admin_managed"
  ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
