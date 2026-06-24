-- BelizeListings — allow dashboard admins to read/update all public.profiles via RLS.
--
-- Root issue: policies that only allow auth.uid() = id hide every other profile from the
-- browser Supabase client, so admin metrics (count), Users tab, and owner joins look stale.
--
-- Approach: SECURITY DEFINER helper reads the caller's own profile row under elevated rights.
-- SET row_security = off prevents the inner profiles scan from re-entering RLS (avoids false
-- is_admin() on setups where the function owner is still RLS-bound).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.role, '') = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when JWT subject has profiles.role = admin; used by permissive RLS policies. Uses row_security=off so the lookup cannot recurse or be masked by RLS.';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

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
