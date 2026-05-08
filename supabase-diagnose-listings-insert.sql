-- ============================================================================
-- BelizeListings — STRICT INSERT diagnostics for public.listings
-- Run in Supabase SQL Editor (or psql against the project DB).
-- Use this to find the exact server-side requirement blocking INSERTs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Column nullability, defaults, generated columns
-- ---------------------------------------------------------------------------
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_generated,
  c.generation_expression
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'listings'
ORDER BY c.ordinal_position;

-- Columns that are NOT NULL and have no default (common INSERT blockers)
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'listings'
  AND c.is_nullable = 'NO'
  AND c.column_default IS NULL
  AND COALESCE(c.is_generated, '') <> 'ALWAYS'
ORDER BY c.ordinal_position;

-- ---------------------------------------------------------------------------
-- 2) Primary key / unique / check / foreign keys on listings
-- ---------------------------------------------------------------------------
SELECT conname AS constraint_name,
       contype AS type,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.listings'::regclass
ORDER BY contype, conname;

-- Outgoing foreign keys (listings → other tables) — required parents?
SELECT
  tc.constraint_name,
  kcu.column_name AS listings_column,
  ccu.table_schema AS ref_schema,
  ccu.table_name AS ref_table,
  ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'listings'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- ---------------------------------------------------------------------------
-- 3) Triggers on listings (often enforce legacy fields or profile linkage)
-- ---------------------------------------------------------------------------
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'listings'
ORDER BY trigger_name;

-- Function source for trigger bodies (adjust names from query above)
-- Example:
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'your_trigger_fn';

-- ---------------------------------------------------------------------------
-- 4) RLS: enabled + INSERT policies
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'listings';

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'listings'
ORDER BY policyname;

-- ---------------------------------------------------------------------------
-- 5) Focus: user_id / agent_id / auth linkage
--    Compare with your app: buildCreateListingPayload sets user_id;
--    if the DB still requires agent_id or a valid profiles row, inserts fail.
-- ---------------------------------------------------------------------------
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'listings'
  AND column_name IN ('user_id', 'agent_id', 'created_by', 'listed_by', 'managed_by', 'profile_id')
ORDER BY column_name;

-- Does profiles need a row for the inserting user? (FK from listings.user_id → profiles.id)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'listings'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name IN ('user_id', 'agent_id');

-- ---------------------------------------------------------------------------
-- 6) Enum / domain types used by listings (status values must match)
-- ---------------------------------------------------------------------------
SELECT
  c.column_name,
  c.data_type,
  c.udt_name
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'listings'
  AND c.data_type IN ('USER-DEFINED', 'ARRAY')
ORDER BY c.ordinal_position;

-- If udt_name is a custom enum, list values:
-- SELECT enumlabel FROM pg_enum e
-- JOIN pg_type t ON t.oid = e.enumtypid
-- WHERE t.typname = 'your_enum_name'
-- ORDER BY enumsortorder;

-- ---------------------------------------------------------------------------
-- 7) Grants (less common on Supabase but worth checking)
-- ---------------------------------------------------------------------------
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'listings'
ORDER BY grantee, privilege_type;
