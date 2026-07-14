-- CRM viewing / inbox separation: restore viewing notification presentation cases
-- overwritten by geographic_update migration; support viewing_requested body with slot copy.

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
  v_slot_label text;
BEGIN
  v_inquiry_id := COALESCE(p_payload->>'inquiry_id', p_payload->>'inquiryId');
  v_conversation_id := COALESCE(p_payload->>'conversation_id', p_payload->>'conversationId');
  v_listing_id := COALESCE(p_payload->>'listing_id', p_payload->>'listingId');
  v_viewing_id := COALESCE(p_payload->>'viewing_id', p_payload->>'viewingId');
  v_message_id := COALESCE(p_payload->>'message_id', p_payload->>'messageId');
  v_inquiry_type := COALESCE(p_payload->>'inquiry_type', p_payload->>'inquiryType', 'general');
  v_listing_title := COALESCE(
    NULLIF(trim(p_payload->>'listing_title'), ''),
    NULLIF(trim(p_payload->>'listingTitle'), ''),
    'your listing'
  );
  v_slot_label := COALESCE(
    NULLIF(trim(p_payload->>'slot_label'), ''),
    NULLIF(trim(p_payload->>'slotLabel'), ''),
    NULLIF(trim(p_payload->>'formatted_slot'), ''),
    NULLIF(trim(p_payload->>'formattedSlot'), '')
  );

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

    WHEN 'viewing_requested' THEN
      category := 'inquiry';
      title := 'New viewing request';
      body := CASE
        WHEN v_slot_label IS NOT NULL THEN
          'A buyer requested a viewing for ' || v_listing_title || ' on ' || v_slot_label || '.'
        ELSE
          'A buyer requested a viewing for ' || v_listing_title || '.'
      END;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_requested:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_confirmed' THEN
      category := 'inquiry';
      title := 'Viewing confirmed';
      body := CASE
        WHEN v_slot_label IS NOT NULL THEN
          'Your viewing for ' || v_listing_title || ' is confirmed for ' || v_slot_label || '.'
        ELSE
          'Your requested viewing time has been confirmed.'
      END;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_confirmed:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_declined' THEN
      category := 'inquiry';
      title := 'Viewing declined';
      body := 'The listing contact could not accommodate your requested viewing time.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_declined:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_rescheduled' THEN
      category := 'inquiry';
      title := 'Viewing reschedule proposed';
      body := CASE
        WHEN v_slot_label IS NOT NULL THEN
          'A new time was proposed for your viewing of ' || v_listing_title || ': ' || v_slot_label || '.'
        ELSE
          'A new time was proposed for your viewing — review and respond.'
      END;
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_rescheduled:' || COALESCE(v_viewing_id, ''));

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
