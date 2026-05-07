-- Internal property/unit management (additive only).
-- This script does not alter existing listing behavior.

-- Ensure uuid_generate_v4() is available.
create extension if not exists "uuid-ossp";

create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  address text,
  district text,
  property_type text, -- house, apartment, commercial, mixed
  created_at timestamp default now()
);

create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade,
  name text, -- Unit A, Apt 2B, Office 3
  rent_amount numeric,
  status text default 'vacant', -- occupied | vacant
  vacant_since timestamp,
  created_at timestamp default now()
);

alter table listings
add column if not exists property_id uuid references properties(id) on delete set null;

alter table listings
add column if not exists unit_id uuid references units(id) on delete set null;
