-- Fix geographic broadcast: listings table uses user_id only on production (listed_by/managed_by not migrated)
CREATE OR REPLACE FUNCTION public.broadcast_geographic_update_v1()
RETURNS TABLE (
  recipients_targeted bigint,
  notifications_inserted bigint,
  notifications_skipped bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_targeted bigint := 0;
  v_inserted bigint := 0;
  v_skipped bigint := 0;
  v_dedupe text := 'geographic_update_v1:2026-07-13';
  u record;
BEGIN
  FOR u IN
    SELECT DISTINCT p.id AS user_id
    FROM public.profiles p
    WHERE lower(COALESCE(p.role, 'user')) IN ('user', 'agent', 'admin', 'operator')
      AND (
        EXISTS (SELECT 1 FROM public.listings l WHERE l.user_id = p.id)
        OR lower(COALESCE(p.role, 'user')) IN ('agent', 'admin', 'operator')
      )
  LOOP
    v_targeted := v_targeted + 1;

    BEGIN
      INSERT INTO public.notifications (
        recipient_user_id,
        category,
        event_type,
        entity_type,
        entity_id,
        title,
        body,
        payload,
        dedupe_key
      ) VALUES (
        u.user_id,
        'guidance',
        'geographic_update_v1',
        'system',
        'geographic-update-v1',
        'Welcome to the Geographic Update! V1.0',
        'BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.',
        jsonb_build_object(
          'cta', 'Update My Listings',
          'dedupe_key', v_dedupe,
          'launch', '2026-07-13'
        ),
        v_dedupe
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  recipients_targeted := v_targeted;
  notifications_inserted := v_inserted;
  notifications_skipped := v_skipped;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_geographic_update_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_geographic_update_v1() TO service_role;
