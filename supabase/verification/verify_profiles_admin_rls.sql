-- =============================================================================
-- BelizeListings — read-only verification: public.profiles RLS + is_admin()
-- =============================================================================
--
-- This file is for manual runs in the Supabase SQL Editor (or psql). It does
-- not modify the database. Repo-only checks: we cannot confirm your remote DB
-- has applied migrations; compare output to expectations below.
--
-- ADMIN ROLE (required for client-side admin visibility):
--   The browser Supabase client uses the logged-in user's JWT. Policy
--   `profiles_select_admin_all` allows all rows only when public.is_admin() is
--   true. After migration 20260512190000_profiles_admin_rls_fix.sql, is_admin()
--   treats role case-insensitively (trimmed). Migration 20260512180000 used
--   exact match: COALESCE(role,'') = 'admin'.
--
--   The Next.js admin route also checks role === "admin" (exact lowercase) in
--   useUserRole. Store role as lowercase 'admin' in public.profiles so both the
--   app gate and RLS agree.
--
--   Fix a single admin user (run as postgres / service role — bypasses RLS):
--     UPDATE public.profiles SET role = 'admin' WHERE id = '<auth.users.id>';
--
-- is_admin() and the SQL Editor:
--   The SQL Editor session is typically the postgres role, not your end user.
--   auth.uid() is usually NULL there, so SELECT public.is_admin(); returns
--   false even for real admins. That is expected.
--
--   How to validate is_admin() with a real JWT:
--   (1) Browser: DevTools → Network → a PostgREST request while logged in as
--       admin → confirm responses include multiple profile rows where you
--       query without .eq('id', ...).
--   (2) Use a REST/RPC call with the anon key + Authorization: Bearer <user
--       access_token> (same as the app), or any Supabase "run as user" tool
--       if your org enables it.
--   (3) Service role / postgres: use the catalog queries below (policies,
--       function body, row counts). Row counts are authoritative for "how many
--       profiles exist"; RLS does not hide rows from postgres.
--
-- =============================================================================

-- A) Recent profiles (shape + timestamps)
SELECT *
FROM public.profiles
ORDER BY created_at DESC NULLS LAST
LIMIT 20;

-- B) RLS enabled on table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- C) All policies on public.profiles (expect: select_own, insert_own,
--    update_own, select_admin_all, update_admin_managed — names may vary if
--    you customized)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

-- D) is_admin() implementation (prosrc = internal body; prosecdef = true means
--    SECURITY DEFINER). If multiple rows, pick public schema.
SELECT n.nspname AS schema,
       p.proname,
       p.prosecdef,
       p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'is_admin'
ORDER BY n.nspname;

-- E) Full DDL (optional; easiest to eyeball search_path + row_security)
SELECT pg_get_functiondef(p.oid) AS is_admin_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';

-- F) All profile ids / roles (postgres sees full table)
SELECT id, email, role
FROM public.profiles
ORDER BY created_at DESC NULLS LAST;

-- G) Total row count (postgres / service role)
SELECT count(*) AS profiles_total FROM public.profiles;

-- H) is_admin() from SQL editor (usually false — see header)
SELECT public.is_admin() AS is_admin_from_this_session;
