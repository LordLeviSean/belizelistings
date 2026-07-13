-- BelizeListings — Geography V1 listing backfill (idempotent)
-- Maps legacy district/region_slug/subregion_slug to V1 columns without changing publication status.

CREATE OR REPLACE FUNCTION public.backfill_listing_geography_v1()
RETURNS TABLE (
  total_rows bigint,
  exact_count bigint,
  partial_count bigint,
  alias_count bigint,
  unmatched_count bigint,
  skipped_already_migrated bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint := 0;
  v_exact bigint := 0;
  v_partial bigint := 0;
  v_alias bigint := 0;
  v_unmatched bigint := 0;
  v_skipped bigint := 0;
  r public.listings%ROWTYPE;
  v_map text;
  v_community text;
  v_status text;
  v_sub text;
  v_region text;
BEGIN
  FOR r IN SELECT * FROM public.listings LOOP
    v_total := v_total + 1;

    IF r.geo_migrated_at IS NOT NULL AND r.map_region_slug IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_sub := lower(trim(COALESCE(r.subregion_slug, '')));
    v_region := lower(trim(COALESCE(r.region_slug, r.district, '')));

    v_map := NULL;
    v_community := NULL;
    v_status := 'unmatched';

    -- Ambergris San Pedro
    IF v_region = 'ambergris-caye' AND v_sub = 'san-pedro' THEN
      v_map := 'ambergris-caye';
      v_community := 'area-ambergris-caye-san-pedro';
      v_status := 'exact';
    -- Caye Caulker
    ELSIF v_region = 'caye-caulker' OR v_sub = 'caye-caulker' THEN
      v_map := 'caye-caulker';
      v_community := 'area-caye-caulker-caye-caulker-village';
      v_status := CASE WHEN v_sub = 'caye-caulker' THEN 'exact' ELSE 'partial' END;
    -- Known subregion/community slugs
    ELSIF v_sub = 'belize-city' OR v_sub = 'belize city' THEN
      v_map := 'belize'; v_community := 'area-belize-belize-city'; v_status := 'exact';
    ELSIF v_sub = 'san-pedro' AND v_region = 'ambergris-caye' THEN
      v_map := 'ambergris-caye'; v_community := 'area-ambergris-caye-san-pedro'; v_status := 'exact';
    ELSIF v_sub = 'san-pedro' AND v_region = 'corozal' THEN
      v_map := 'corozal'; v_community := 'area-corozal-san-pedro'; v_status := 'exact';
    ELSIF v_sub IN ('placencia', 'belmopan', 'san-ignacio', 'santa-elena', 'corozal', 'orange-walk', 'dangriga', 'punta-gorda', 'punta-gorda-town') THEN
      v_map := CASE v_sub
        WHEN 'placencia' THEN 'stann-creek'
        WHEN 'belmopan' THEN 'cayo'
        WHEN 'san-ignacio' THEN 'cayo'
        WHEN 'santa-elena' THEN 'cayo'
        WHEN 'corozal' THEN 'corozal'
        WHEN 'orange-walk' THEN 'orange-walk'
        WHEN 'dangriga' THEN 'stann-creek'
        WHEN 'punta-gorda' THEN 'toledo'
        WHEN 'punta-gorda-town' THEN 'toledo'
      END;
      v_community := CASE v_sub
        WHEN 'placencia' THEN 'area-stann-creek-placencia'
        WHEN 'belmopan' THEN 'area-cayo-belmopan'
        WHEN 'san-ignacio' THEN 'area-cayo-san-ignacio'
        WHEN 'santa-elena' THEN 'area-cayo-santa-elena'
        WHEN 'corozal' THEN 'area-corozal-corozal'
        WHEN 'orange-walk' THEN 'area-orange-walk-orange-walk'
        WHEN 'dangriga' THEN 'area-stann-creek-dangriga'
        WHEN 'punta-gorda' THEN 'area-toledo-punta-gorda'
        WHEN 'punta-gorda-town' THEN 'area-toledo-punta-gorda'
      END;
      v_status := 'exact';
    ELSIF v_sub IN ('independence', 'mango-creek', 'mango creek') THEN
      v_map := 'stann-creek';
      v_community := 'area-stann-creek-independence';
      v_status := 'alias';
    ELSIF v_region IN ('belize', 'cayo', 'corozal', 'orange-walk', 'stann-creek', 'toledo', 'ambergris-caye', 'caye-caulker') THEN
      v_map := v_region;
      v_community := NULL;
      v_status := 'partial';
    ELSE
      v_map := NULL;
      v_community := NULL;
      v_status := 'unmatched';
    END IF;

    UPDATE public.listings
    SET
      map_region_slug = v_map,
      community_id = v_community,
      geo_backfill_status = v_status,
      geo_migrated_at = timezone('utc'::text, now())
    WHERE id = r.id;

    IF v_status = 'exact' THEN v_exact := v_exact + 1;
    ELSIF v_status = 'partial' THEN v_partial := v_partial + 1;
    ELSIF v_status = 'alias' THEN v_alias := v_alias + 1;
    ELSE v_unmatched := v_unmatched + 1;
    END IF;
  END LOOP;

  total_rows := v_total;
  exact_count := v_exact;
  partial_count := v_partial;
  alias_count := v_alias;
  unmatched_count := v_unmatched;
  skipped_already_migrated := v_skipped;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_listing_geography_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_listing_geography_v1() TO service_role;

COMMENT ON FUNCTION public.backfill_listing_geography_v1 IS
  'One-time idempotent backfill of listings.map_region_slug / community_id from legacy slugs.';
