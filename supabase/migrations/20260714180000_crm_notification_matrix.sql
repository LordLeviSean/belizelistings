-- CRM V1.0 final polish: complete notification matrix + owner-initiated messaging thread.

-- ---------------------------------------------------------------------------
-- ensure_messaging_conversation — open Inbox thread without buyer-first message
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_messaging_conversation(
  p_listing_id bigint,
  p_agent_user_id uuid,
  p_buyer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_conversation_id uuid;
  v_inquiry_id uuid;
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF p_listing_id IS NULL OR p_agent_user_id IS NULL OR p_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'listing_id, agent_user_id, and buyer_user_id are required';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_agent_user_id THEN
    IF NOT public.is_service_role_context() AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'only listing contact may open this thread';
    END IF;
  END IF;

  SELECT c.id, c.inquiry_id
  INTO v_conversation_id, v_inquiry_id
  FROM public.conversations c
  JOIN public.listing_inquiries li ON li.id = c.inquiry_id
  WHERE c.listing_id = p_listing_id
    AND c.agent_id = p_agent_user_id
    AND c.buyer_id = p_buyer_user_id
    AND COALESCE(li.inquiry_type, 'general') <> 'schedule_viewing'
    AND c.agent_deleted_at IS NULL
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'conversation_id', v_conversation_id,
      'inquiry_id', v_inquiry_id,
      'created', false
    );
  END IF;

  INSERT INTO public.listing_inquiries (
    listing_id, agent_user_id, listing_owner_id,
    sender_user_id, sender_id, channel, body, message,
    inquiry_type, status, pipeline_stage, created_at, updated_at
  ) VALUES (
    p_listing_id, p_agent_user_id, p_agent_user_id,
    p_buyer_user_id, p_buyer_user_id, 'contact', '', '',
    'general', 'new', 'new_inquiry', v_now, v_now
  )
  RETURNING id INTO v_inquiry_id;

  INSERT INTO public.conversations (
    listing_id, inquiry_id, buyer_id, agent_id,
    stage, pipeline_stage, status, created_at, updated_at
  ) VALUES (
    p_listing_id, v_inquiry_id, p_buyer_user_id, p_agent_user_id,
    'new_inquiry', 'new_inquiry', 'open', v_now, v_now
  )
  RETURNING id INTO v_conversation_id;

  RETURN jsonb_build_object(
    'conversation_id', v_conversation_id,
    'inquiry_id', v_inquiry_id,
    'created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_messaging_conversation(bigint, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_messaging_conversation(bigint, uuid, uuid) TO authenticated;

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
