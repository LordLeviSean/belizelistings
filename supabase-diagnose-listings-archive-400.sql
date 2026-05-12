-- =============================================================================
-- Diagnostics when PATCH /listings returns 400 even for { "status": "archived" }
-- Run in Supabase SQL Editor (read-only SELECTs + optional auth checks).
-- =============================================================================

-- 1) Column type for status (expect text; if USER-DEFINED → enum — check allowed labels)
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'listings'
  AND column_name = 'status';

-- 1b) If data_type = USER-DEFINED: list every allowed enum label for that column
SELECT t.typname AS enum_type_name, e.enumlabel, e.enumsortorder
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_type t ON a.atttypid = t.oid
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
  AND c.relname = 'listings'
  AND a.attname = 'status'
  AND NOT a.attisdropped
ORDER BY e.enumsortorder;

-- 2) CHECK constraints on listings (if status is restricted, 'archived' must be listed)
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'listings'
  AND c.contype = 'c'
ORDER BY c.conname;

-- 3) Non-internal triggers on listings (BEFORE UPDATE often enforces transitions)
SELECT tgname, tgenabled, pg_get_triggerdef(trig.oid, true) AS definition
FROM pg_trigger trig
JOIN pg_class t ON trig.tgrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'listings'
  AND NOT trig.tgisinternal
ORDER BY tgname;

-- 4) RLS enabled + policy names
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND c.relname = 'listings';

SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.listings'::regclass
ORDER BY polname;

-- 5) Sample row + owner (replace 35 with failing id)
SELECT id, user_id, status, lifecycle_status, moderation_status
FROM public.listings
WHERE id = 35;

-- 6) Does your logged-in admin user actually have profiles.role = 'admin'?
-- Replace with your auth user id from Supabase Auth / JWT.
-- SELECT id, role FROM public.profiles WHERE id = 'YOUR_AUTH_UID_HERE';

-- 7) Map common PostgREST / Postgres error codes (from browser Network response body or raw error)
-- 23514 = CHECK violation
-- 22P02 = invalid_text_representation (often enum)
-- 42501 = insufficient_privilege
-- 42P10 = invalid_column_reference (rare on simple update)

-- =============================================================================
-- Common fixes (DO NOT run blindly — confirm with sections 1–4 first):
--
-- A) CHECK constraint missing 'archived':
--    Drop or replace the constraint so 'archived' is allowed.
--
-- B) RLS: admin policy uses profiles.role = 'admin' but your row says 'Admin' / null:
--    UPDATE profiles SET role = 'admin' WHERE id = '...';
--
-- C) RLS: operator/broker needs update policy — repo only has agent-own + admin full.
--
-- D) Trigger rejects transition approved → archived:
--    Adjust trigger or status transition rules.
-- =============================================================================
