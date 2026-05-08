-- =============================================================================
-- MINIMAL DB FIXES: allow status = 'archived' on public.listings
-- Prerequisites: run supabase-diagnose-listings-archive-400.sql and identify
-- which single category below matches your failure (enum / CHECK / RLS / trigger).
--
-- DO NOT run every section — only the one that matches diagnosis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FIX 1 — ENUM: Query (1) shows data_type = USER-DEFINED and (1b) has NO
--         'archived' label. API error often mentions "enum" or code 22P02.
--
-- Replace public.<enum_type_name> with typname from query (1b), e.g. listing_status
-- Risk: LOW. ADD VALUE IF NOT EXISTS is idempotent on modern Postgres (Supabase).
-- Note: ALTER TYPE ... ADD VALUE may need to run outside a long transaction on
--       very old Postgres; Supabase PG15+ is fine in SQL Editor.
-- -----------------------------------------------------------------------------
-- ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'archived';


-- -----------------------------------------------------------------------------
-- FIX 2 — CHECK constraint: Query (2) shows CHECK (status IN (...)) without
--         'archived'. Error code often 23514; message names the constraint.
--
-- Replace constraint name + full IN list with values from your current
-- pg_get_constraintdef output, plus 'archived'.
-- Risk: MEDIUM. Wrong conname drops the wrong rule; verify name from diagnose (2).
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
-- ALTER TABLE public.listings
--   ADD CONSTRAINT listings_status_check
--   CHECK (
--     status IN (
--       'draft',
--       'pending',
--       'approved',
--       'rejected',
--       'deleted',
--       'archived'
--     )
--   );


-- -----------------------------------------------------------------------------
-- FIX 3 — RLS / admin role: Policies match supabase-listings-migrate-to-user-id.sql
--         Admins need profiles.role exactly 'admin'. No schema change.
--
-- Replace UUID with auth.users.id / JWT sub for the account using the admin UI.
-- Risk: LOW for a single row; confirm you are not demoting another principal.
-- -----------------------------------------------------------------------------
-- SELECT id, role FROM public.profiles WHERE id = 'PASTE_AUTH_USER_UUID';
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = 'PASTE_AUTH_USER_UUID'
--   AND role IS DISTINCT FROM 'admin';


-- -----------------------------------------------------------------------------
-- FIX 4 — RLS / non-admin operator: Your session is authenticated but not
--         user_id on the row and not role = 'admin'. Add a policy OR use service
--         role only in trusted backends — do not widen RLS casually.
--
-- Example ONLY if you intentionally grant brokers/operators update-any-listing:
-- Risk: HIGH. Exposes update to extra roles; prefer narrow USING/WITH CHECK.
-- -----------------------------------------------------------------------------
-- create policy "Brokers update all listings"
-- on public.listings
-- for update
-- to authenticated
-- using (
--   exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.role in ('broker','brokerage','admin')
--   )
-- )
-- with check (
--   exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.role in ('broker','brokerage','admin')
--   )
-- );


-- -----------------------------------------------------------------------------
-- FIX 5 — TRIGGER: Query (3) shows a BEFORE UPDATE trigger that raises or
--         restricts status transitions. No generic fix here — open trigger body,
--         allow transition to 'archived' from 'approved' (and others you need).
-- Risk: MEDIUM — depends on business rules; test on a copy row first.
-- -----------------------------------------------------------------------------
