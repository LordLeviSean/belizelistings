-- Add role to profiles
alter table profiles
add column if not exists role text default 'user';

-- Add agent_id + timestamps to listings
alter table listings
add column if not exists agent_id uuid references profiles(id),
add column if not exists created_at timestamp default now(),
add column if not exists updated_at timestamp default now();

-- Create agent_requests table
create table if not exists agent_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  full_name text,
  phone text,
  message text,
  status text default 'pending',
  created_at timestamp default now()
);

alter table listings enable row level security;
alter table agent_requests enable row level security;

-- listings
create policy if not exists "Public read approved listings"
on listings for select
to anon, authenticated
using (status = 'approved');

create policy if not exists "Agents can view own listings"
on listings for select
to authenticated
using (auth.uid() = agent_id);

create policy if not exists "Agents can insert listings"
on listings for insert
to authenticated
with check (auth.uid() = agent_id);

-- agent_requests
create policy if not exists "Users can create requests"
on agent_requests for insert
to authenticated
with check (auth.uid() = user_id);

create policy if not exists "Users can view own requests"
on agent_requests for select
to authenticated
using (auth.uid() = user_id);
