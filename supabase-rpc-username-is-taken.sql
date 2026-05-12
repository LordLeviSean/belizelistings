-- Public signup: allow anon to ask if a username is taken (no row data exposed).
-- Run in Supabase SQL editor after profiles.username exists.

create or replace function public.username_is_taken(check_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles p
    where p.username is not null
      and lower(trim(p.username)) = lower(trim(check_username))
  );
$$;

revoke all on function public.username_is_taken(text) from public;
grant execute on function public.username_is_taken(text) to anon, authenticated;
