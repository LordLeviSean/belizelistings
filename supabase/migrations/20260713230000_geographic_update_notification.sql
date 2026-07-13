-- BelizeListings — Geographic Update V1.0 global notification (idempotent)
-- Dedupe key: geographic_update_v1:2026-07-13

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

-- Extend notification presentation helper for geographic_update_v1
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
BEGIN
  v_inquiry_id := COALESCE(p_payload->>'inquiry_id', p_payload->>'inquiryId');
  v_conversation_id := COALESCE(p_payload->>'conversation_id', p_payload->>'conversationId');
  v_listing_id := COALESCE(p_payload->>'listing_id', p_payload->>'listingId');
  v_viewing_id := COALESCE(p_payload->>'viewing_id', p_payload->>'viewingId');
  v_message_id := COALESCE(p_payload->>'message_id', p_payload->>'messageId');
  v_inquiry_type := COALESCE(p_payload->>'inquiry_type', p_payload->>'inquiryType', 'general');

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
      title := 'New inquiry on your listing';
      body := CASE
        WHEN v_inquiry_type = 'schedule_viewing' THEN 'A buyer requested a viewing time.'
        ELSE 'A buyer left a note—your response keeps the conversation moving.'
      END;
      entity_type := 'inquiry';
      entity_id := v_inquiry_id;
      dedupe_key := COALESCE(dedupe_key, 'new_inquiry:' || COALESCE(v_inquiry_id, v_conversation_id, ''));

    WHEN 'agent_replied' THEN
      category := 'inquiry';
      title := 'Your agent replied';
      body := 'A new message is waiting in your conversation.';
      entity_type := 'conversation';
      entity_id := v_conversation_id;
      dedupe_key := COALESCE(
        dedupe_key,
        'agent_replied:' || COALESCE(v_conversation_id, '') || ':' || COALESCE(v_message_id, '')
      );

    WHEN 'viewing_confirmed' THEN
      category := 'inquiry';
      title := 'Viewing confirmed';
      body := 'Your requested viewing time has been confirmed.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_confirmed:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_cancelled' THEN
      category := 'inquiry';
      title := 'Viewing cancelled';
      body := 'A scheduled viewing was cancelled.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_cancelled:' || COALESCE(v_viewing_id, ''));

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
