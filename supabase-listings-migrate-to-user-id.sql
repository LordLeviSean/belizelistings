-- =============================================================================
-- Listings: remove agent_id, RLS on user_id only
-- Run in Supabase SQL editor in order. Idempotent where noted.
-- =============================================================================

-- 0) Columns + backfill user_id from agent_id (if column still exists)
alter table listings
  add column if not exists user_id uuid references profiles(id);

alter table listings
  add column if not exists reviewed_by uuid references profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'agent_id'
  ) then
    update listings
    set user_id = agent_id
    where user_id is null
      and agent_id is not null;
  end if;
end $$;

-- Normalize any unknown statuses to draft (safe fallback)
update listings
set status = 'draft'
where status not in ('draft', 'pending', 'approved', 'rejected', 'deleted');

-- If any row still has null user_id, fix before dropping agent_id (owner must be set)
-- select id, title from listings where user_id is null;

-- =============================================================================
-- 1) Drop ALL existing listings policies (names from agent_id era + later migrations)
-- =============================================================================
drop policy if exists "Public read approved listings" on listings;
drop policy if exists "Public can view approved listings" on listings;
drop policy if exists "Public can view approved + own" on listings;
drop policy if exists "Agents can view own listings" on listings;
drop policy if exists "Agents can insert listings" on listings;
drop policy if exists "Agents can create listings" on listings;
drop policy if exists "Agents update own listings" on listings;
drop policy if exists "Agents can update own listings" on listings;
drop policy if exists "Agents can delete own listings" on listings;
drop policy if exists "Admins read all listings" on listings;
drop policy if exists "Admins update all listings" on listings;
drop policy if exists "Admins full access" on listings;

-- Add any other custom policy names here if your project has them, then re-run

-- =============================================================================
-- 2) Recreate policies — user_id for owner; admin; public read approved
-- =============================================================================

-- Authenticated owners (agents) — full CRUD on own rows
create policy "Agents can view own listings"
on listings for select
to authenticated
using (auth.uid() = user_id);

create policy "Agents can insert listings"
on listings for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Agents can update own listings"
on listings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Agents can delete own listings"
on listings for delete
to authenticated
using (auth.uid() = user_id);

-- Admins — all operations
create policy "Admins full access"
on listings
for all
to authenticated
using (
  exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Public browse — approved only (anon + signed-in)
create policy "Public can view approved listings"
on listings for select
to anon, authenticated
using (status = 'approved');

-- =============================================================================
-- 3) Drop legacy column (safe only after user_id is backfilled and policies use user_id)
-- =============================================================================
alter table listings
  drop column if exists agent_id;
