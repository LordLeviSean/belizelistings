-- Fix district-blind santa-elena mapping (Toledo vs Cayo) and Corozal san-pedro parity.
-- Re-applies backfill_listing_geography_v1 with district-scoped Santa Elena branches.
-- Restores notification_presentation_for_event viewing_requested/declined/rescheduled
-- branches merged with geographic_update_v1 (regression from 20260713230000).

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
    ELSIF v_sub = 'santa-elena' AND v_region = 'toledo' THEN
      v_map := 'toledo'; v_community := 'area-toledo-santa-elena'; v_status := 'exact';
    ELSIF v_sub = 'santa-elena' AND v_region = 'cayo' THEN
      v_map := 'cayo'; v_community := 'area-cayo-santa-elena'; v_status := 'exact';
    ELSIF v_sub IN ('placencia', 'belmopan', 'san-ignacio', 'corozal', 'orange-walk', 'dangriga', 'punta-gorda', 'punta-gorda-town') THEN
      v_map := CASE v_sub
        WHEN 'placencia' THEN 'stann-creek'
        WHEN 'belmopan' THEN 'cayo'
        WHEN 'san-ignacio' THEN 'cayo'
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
-- ---------------------------------------------------------------------------
-- notification_presentation_for_event — complete CRM matrix
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notification_presentation_for_event(
  p_event_type text,
  p_payload jsonb
)
RETURNS TABLE (
  category text,
  title text,
  body text,
  entity_type text,
  entity_id text,
  dedupe_key text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_inquiry_id text;
  v_conversation_id text;
  v_listing_id text;
  v_viewing_id text;
  v_message_id text;
  v_inquiry_type text;
  v_listing_title text;
  v_sender_name text;
  v_slot_label text;
BEGIN
  v_inquiry_id := COALESCE(p_payload->>'inquiry_id', p_payload->>'inquiryId');
  v_conversation_id := COALESCE(p_payload->>'conversation_id', p_payload->>'conversationId');
  v_listing_id := COALESCE(p_payload->>'listing_id', p_payload->>'listingId');
  v_viewing_id := COALESCE(p_payload->>'viewing_id', p_payload->>'viewingId');
  v_message_id := COALESCE(p_payload->>'message_id', p_payload->>'messageId');
  v_inquiry_type := COALESCE(p_payload->>'inquiry_type', p_payload->>'inquiryType', 'general');
  v_listing_title := COALESCE(NULLIF(trim(p_payload->>'listing_title'), ''), NULLIF(trim(p_payload->>'listingTitle'), ''), 'your listing');
  v_sender_name := COALESCE(NULLIF(trim(p_payload->>'sender_name'), ''), NULLIF(trim(p_payload->>'senderName'), ''), NULLIF(trim(p_payload->>'requester_name'), ''), 'A buyer');
  v_slot_label := COALESCE(NULLIF(trim(p_payload->>'slot_label'), ''), NULLIF(trim(p_payload->>'slotLabel'), ''), NULLIF(trim(p_payload->>'formatted_slot'), ''));

  category := 'system';
  title := 'Operational update';
  body := NULL;
  entity_type := NULL;
  entity_id := NULL;
  dedupe_key := COALESCE(p_payload->>'dedupe_key', p_payload->>'dedupeKey');

  IF p_event_type = 'geographic_update_v1' THEN
    category := 'guidance';
    title := 'Welcome to the Geographic Update! V1.0';
    body := 'BelizeListings now supports detailed District, City/Town/Village, Neighborhood, Highway and locality information across Belize. Update your current listings now to make sure buyers can find them in the correct area.';
    entity_type := 'system';
    entity_id := 'geographic-update-v1';
    dedupe_key := COALESCE(dedupe_key, 'geographic_update_v1:2026-07-13');
    RETURN NEXT;
    RETURN;
  END IF;

  CASE p_event_type
    WHEN 'new_inquiry' THEN
      category := 'inquiry';
      IF v_inquiry_type = 'schedule_viewing' THEN
        title := 'New viewing request';
        body := v_sender_name || ' requested a viewing for ' || v_listing_title || '.';
      ELSE
        title := 'New message received';
        body := v_sender_name || ' sent you a message about ' || v_listing_title || '.';
      END IF;
      entity_type := 'conversation';
      entity_id := COALESCE(v_conversation_id, v_inquiry_id);
      dedupe_key := COALESCE(dedupe_key, 'new_inquiry:' || COALESCE(v_message_id, v_inquiry_id, v_conversation_id, ''));

    WHEN 'agent_replied' THEN
      category := 'inquiry';
      title := 'You received a reply';
      body := 'You received a reply about ' || v_listing_title || '.';
      entity_type := 'conversation';
      entity_id := v_conversation_id;
      dedupe_key := COALESCE(dedupe_key, 'agent_replied:' || COALESCE(v_conversation_id, '') || ':' || COALESCE(v_message_id, ''));

    WHEN 'viewing_requested' THEN
      category := 'inquiry';
      title := 'New viewing request';
      body := v_sender_name || ' requested a viewing for ' || v_listing_title || '.';
      IF v_slot_label IS NOT NULL THEN
        body := body || E'\n' || v_slot_label;
      END IF;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_requested:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_confirmed' THEN
      category := 'inquiry';
      title := 'Viewing confirmed';
      body := 'Your viewing for ' || v_listing_title || ' has been confirmed.';
      IF v_slot_label IS NOT NULL THEN
        body := body || E'\n' || v_slot_label;
      END IF;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_confirmed:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_declined' THEN
      category := 'inquiry';
      title := 'Viewing declined';
      body := 'Your viewing request for ' || v_listing_title || ' was declined.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_declined:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_rescheduled' THEN
      category := 'inquiry';
      title := 'Viewing rescheduled';
      body := 'A new viewing time has been proposed for ' || v_listing_title || '.';
      IF v_slot_label IS NOT NULL THEN
        body := body || E'\n' || v_slot_label;
      END IF;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_rescheduled:' || COALESCE(v_viewing_id, '') || ':' || COALESCE(p_payload->>'proposed_date', ''));

    WHEN 'viewing_cancelled' THEN
      category := 'inquiry';
      title := 'Viewing cancelled';
      body := 'A viewing for ' || v_listing_title || ' was cancelled.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_cancelled:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_completed' THEN
      category := 'inquiry';
      title := 'Viewing completed';
      body := 'Your viewing for ' || v_listing_title || ' is marked complete.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_completed:' || COALESCE(v_viewing_id, ''));

    WHEN 'inquiry_archived' THEN
      category := 'inquiry';
      title := 'Inquiry archived';
      body := 'An inquiry was moved to your archive.';
      entity_type := 'inquiry';
      entity_id := v_inquiry_id;
      dedupe_key := COALESCE(dedupe_key, 'inquiry_archived:' || COALESCE(v_inquiry_id, ''));

    ELSE
      category := 'system';
      title := 'Operational update';
      body := 'Something changed in your BelizeListings workspace.';
      entity_type := 'system';
      entity_id := NULL;
      dedupe_key := COALESCE(dedupe_key, p_event_type || ':' || md5(COALESCE(p_payload::text, '')));
  END CASE;

  IF dedupe_key IS NULL OR dedupe_key = '' THEN
    dedupe_key := p_event_type || ':' || md5(COALESCE(p_payload::text, ''));
  END IF;

  RETURN NEXT;
END;
$$;
