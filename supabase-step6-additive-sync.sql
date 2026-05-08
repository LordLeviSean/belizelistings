-- Step 6 additive synchronization (safe-first)
-- Run in Supabase SQL editor. Additive only.

alter table listings
  add column if not exists lifecycle_status text,
  add column if not exists moderation_status text,
  add column if not exists published_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists rented_at timestamptz,
  add column if not exists sold_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table listings
  add column if not exists listed_by uuid references profiles(id),
  add column if not exists managed_by uuid references profiles(id),
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists archived_by uuid references profiles(id),
  add column if not exists closed_by uuid references profiles(id),
  add column if not exists moderated_by uuid references profiles(id),
  add column if not exists reviewed_by uuid references profiles(id),
  add column if not exists published_by uuid references profiles(id),
  add column if not exists deleted_by uuid references profiles(id);

alter table listings
  add column if not exists region_slug text,
  add column if not exists subregion_slug text;

alter table listings
  add column if not exists occupancy_status text,
  add column if not exists vacancy_status text,
  add column if not exists occupied_at timestamptz,
  add column if not exists vacated_at timestamptz,
  add column if not exists maintenance_hold boolean default false,
  add column if not exists seasonal_hold boolean default false;

-- Optional internal moderation note scaffolding
alter table listings
  add column if not exists moderation_notes text;

create index if not exists idx_listings_lifecycle_status on listings(lifecycle_status);
create index if not exists idx_listings_moderation_status on listings(moderation_status);
create index if not exists idx_listings_region_slug on listings(region_slug);
create index if not exists idx_listings_subregion_slug on listings(subregion_slug);
create index if not exists idx_listings_archived_at on listings(archived_at);
create index if not exists idx_listings_deleted_at on listings(deleted_at);
create index if not exists idx_listings_user_id_status on listings(user_id, status);

-- Backfill canonical columns from existing semantics
update listings
set lifecycle_status = coalesce(lifecycle_status, status)
where lifecycle_status is null;

update listings
set moderation_status = coalesce(
  moderation_status,
  case
    when status = 'pending' then 'pending_review'
    when status = 'approved' then 'approved'
    when status = 'rejected' then 'rejected'
    when status = 'archived' then 'archived'
    else 'unknown'
  end
)
where moderation_status is null;

update listings
set listed_by = coalesce(listed_by, user_id)
where listed_by is null and user_id is not null;

update listings
set region_slug = coalesce(region_slug, district)
where region_slug is null and district is not null;
