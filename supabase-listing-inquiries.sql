-- BelizeListings — listing inquiries / lead capture (additive migration)
-- Run in Supabase SQL editor after review.

create table if not exists public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_user_id uuid not null references auth.users (id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_name text,
  sender_email text,
  sender_phone text,
  channel text not null default 'contact'
    check (channel in ('contact', 'viewing', 'question')),
  body text not null default '',
  status text not null default 'new'
    check (status in ('new', 'responded', 'scheduled', 'closed')),
  quality_score smallint,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_inquiries_agent_created_idx
  on public.listing_inquiries (agent_user_id, created_at desc);

create index if not exists listing_inquiries_listing_idx
  on public.listing_inquiries (listing_id);

alter table public.listing_inquiries enable row level security;

-- Agents read inquiries routed to them
create policy "listing_inquiries_select_agent"
  on public.listing_inquiries for select
  using (agent_user_id = auth.uid());

-- Senders read rows they created when logged in
create policy "listing_inquiries_select_sender"
  on public.listing_inquiries for select
  using (sender_user_id is not null and sender_user_id = auth.uid());

-- Allow inserting inquiries for approved inventory (public conversion surface)
create policy "listing_inquiries_insert_public_listing"
  on public.listing_inquiries for insert
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and (
          coalesce(l.status, '') in ('approved', 'published')
          or coalesce(l.lifecycle_status, '') in ('approved', 'published')
          or coalesce(l.moderation_status, '') in ('approved', 'published')
        )
    )
    and agent_user_id = (
      select li.user_id from public.listings li where li.id = listing_id limit 1
    )
  );

-- Agents update operational fields on their inbox rows
create policy "listing_inquiries_update_agent"
  on public.listing_inquiries for update
  using (agent_user_id = auth.uid())
  with check (agent_user_id = auth.uid());

comment on table public.listing_inquiries is 'Public listing inquiries / leads routed to listing owner agent.';
