-- Favorites safety + RLS policies

-- Prevent duplicate favorites per user/listing
create unique index if not exists favorites_unique_user_listing
on favorites(user_id, listing_id);

-- Enable RLS
alter table favorites enable row level security;

-- Drop old/legacy policy names
drop policy if exists "Users can view favorites" on favorites;
drop policy if exists "Users can insert favorites" on favorites;
drop policy if exists "Users can delete favorites" on favorites;
drop policy if exists "Users can view own favorites" on favorites;

-- SELECT (user sees own favorites)
create policy "Users can view own favorites"
on favorites for select
to authenticated
using (auth.uid() = user_id);

-- INSERT (user adds favorite)
create policy "Users can insert favorites"
on favorites for insert
to authenticated
with check (auth.uid() = user_id);

-- DELETE (user removes favorite)
create policy "Users can delete favorites"
on favorites for delete
to authenticated
using (auth.uid() = user_id);
