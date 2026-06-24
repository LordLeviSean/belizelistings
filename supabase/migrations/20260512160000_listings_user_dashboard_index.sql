-- BelizeListings — performance index for per-owner listing reads (user + agent dashboards).
-- Safe additive migration. RLS for role `user` matches authenticated owner policies in
-- repo reference `supabase-listings-migrate-to-user-id.sql` (auth.uid() = user_id); no policy change here.

CREATE INDEX IF NOT EXISTS idx_listings_user_id_created_at_desc
  ON public.listings (user_id, created_at DESC);

COMMENT ON INDEX idx_listings_user_id_created_at_desc IS
  'Speeds My Listings / dashboard queries filtered by user_id ordered by created_at.';
