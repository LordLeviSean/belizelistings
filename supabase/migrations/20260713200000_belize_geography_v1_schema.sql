-- BelizeListings — Geography V1 structured location model
-- Workstream: Geographic Update V1.0
-- Rollback: drop geo_* tables after listing geo columns removed (manual)

-- ---------------------------------------------------------------------------
-- Map regions (8 interactive SVG regions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_map_regions (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  administrative_district_id text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'verified_official',
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  zoom_level integer,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------------
-- Communities (cities, towns, villages, islands)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_communities (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  map_region_id text NOT NULL REFERENCES public.geo_map_regions (id) ON DELETE RESTRICT,
  administrative_district_id text,
  location_type text NOT NULL,
  ui_tier text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'verified_official',
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT geo_communities_slug_map_region_unique UNIQUE (slug, map_region_id)
);

CREATE INDEX IF NOT EXISTS geo_communities_map_region_idx
  ON public.geo_communities (map_region_id)
  WHERE active = true;

-- ---------------------------------------------------------------------------
-- Localities (neighborhoods, subdivisions, developments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_localities (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  community_id text NOT NULL REFERENCES public.geo_communities (id) ON DELETE RESTRICT,
  map_region_id text NOT NULL REFERENCES public.geo_map_regions (id) ON DELETE RESTRICT,
  location_type text NOT NULL,
  ui_tier text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'verified_common_usage',
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT geo_localities_slug_community_unique UNIQUE (slug, community_id)
);

CREATE INDEX IF NOT EXISTS geo_localities_community_idx
  ON public.geo_localities (community_id)
  WHERE active = true;

-- ---------------------------------------------------------------------------
-- Highways (canonical — one row per physical highway)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_highways (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  approx_mile_max integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'verified_official',
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.geo_highway_map_regions (
  highway_id text NOT NULL REFERENCES public.geo_highways (id) ON DELETE CASCADE,
  map_region_id text NOT NULL REFERENCES public.geo_map_regions (id) ON DELETE CASCADE,
  PRIMARY KEY (highway_id, map_region_id)
);

CREATE TABLE IF NOT EXISTS public.geo_highway_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highway_id text NOT NULL REFERENCES public.geo_highways (id) ON DELETE CASCADE,
  mile_number numeric NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (highway_id, mile_number)
);

-- ---------------------------------------------------------------------------
-- Road corridors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_road_corridors (
  id text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  map_region_id text NOT NULL REFERENCES public.geo_map_regions (id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'verified_common_usage',
  PRIMARY KEY (id, map_region_id)
);

-- ---------------------------------------------------------------------------
-- Aliases (parent-scoped search identity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_normalized text NOT NULL,
  alias_display text NOT NULL,
  target_id text NOT NULL,
  target_level text NOT NULL,
  map_region_id text REFERENCES public.geo_map_regions (id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS geo_aliases_norm_target_region_unique
  ON public.geo_aliases (
    alias_normalized,
    target_id,
    COALESCE(map_region_id, ''::text)
  );

-- ---------------------------------------------------------------------------
-- Admin review: locality not listed submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_locality_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint REFERENCES public.listings (id) ON DELETE SET NULL,
  map_region_id text,
  community_id text,
  proposed_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- RLS — public read, admin write
-- ---------------------------------------------------------------------------
ALTER TABLE public.geo_map_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_highways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_highway_map_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_highway_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_road_corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_locality_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_map_regions_select_public" ON public.geo_map_regions;
CREATE POLICY "geo_map_regions_select_public"
  ON public.geo_map_regions FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_map_regions_admin_write" ON public.geo_map_regions;
CREATE POLICY "geo_map_regions_admin_write"
  ON public.geo_map_regions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "geo_communities_select_public" ON public.geo_communities;
CREATE POLICY "geo_communities_select_public"
  ON public.geo_communities FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_communities_admin_write" ON public.geo_communities;
CREATE POLICY "geo_communities_admin_write"
  ON public.geo_communities FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "geo_localities_select_public" ON public.geo_localities;
CREATE POLICY "geo_localities_select_public"
  ON public.geo_localities FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_localities_admin_write" ON public.geo_localities;
CREATE POLICY "geo_localities_admin_write"
  ON public.geo_localities FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "geo_highways_select_public" ON public.geo_highways;
CREATE POLICY "geo_highways_select_public"
  ON public.geo_highways FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_highways_admin_write" ON public.geo_highways;
CREATE POLICY "geo_highways_admin_write"
  ON public.geo_highways FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "geo_highway_map_regions_select_public" ON public.geo_highway_map_regions;
CREATE POLICY "geo_highway_map_regions_select_public"
  ON public.geo_highway_map_regions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "geo_highway_map_regions_admin_write" ON public.geo_highway_map_regions;
CREATE POLICY "geo_highway_map_regions_admin_write"
  ON public.geo_highway_map_regions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "geo_highway_sections_select_public" ON public.geo_highway_sections;
CREATE POLICY "geo_highway_sections_select_public"
  ON public.geo_highway_sections FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_road_corridors_select_public" ON public.geo_road_corridors;
CREATE POLICY "geo_road_corridors_select_public"
  ON public.geo_road_corridors FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_aliases_select_public" ON public.geo_aliases;
CREATE POLICY "geo_aliases_select_public"
  ON public.geo_aliases FOR SELECT
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "geo_locality_requests_insert_auth" ON public.geo_locality_requests;
CREATE POLICY "geo_locality_requests_insert_auth"
  ON public.geo_locality_requests FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "geo_locality_requests_select_own_or_admin" ON public.geo_locality_requests;
CREATE POLICY "geo_locality_requests_select_own_or_admin"
  ON public.geo_locality_requests FOR SELECT
  USING (submitted_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "geo_locality_requests_admin_update" ON public.geo_locality_requests;
CREATE POLICY "geo_locality_requests_admin_update"
  ON public.geo_locality_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.geo_map_regions TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_communities TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_localities TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_highways TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_highway_map_regions TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_highway_sections TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_road_corridors TO anon, authenticated;
GRANT SELECT ON TABLE public.geo_aliases TO anon, authenticated;
