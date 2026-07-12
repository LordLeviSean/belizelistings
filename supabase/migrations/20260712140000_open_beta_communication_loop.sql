-- Open Beta communication loop: conversation previews, viewing proposer, notification copy.

-- ---------------------------------------------------------------------------
-- viewing_requests — who proposed the current reschedule slot
-- ---------------------------------------------------------------------------

ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS proposed_by text;

COMMENT ON COLUMN public.viewing_requests.proposed_by IS
  'Who proposed proposed_date/time: agent or buyer.';

-- ---------------------------------------------------------------------------
-- notification_presentation_for_event — viewing_requested/declined/rescheduled
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
      dedupe_key := COALESCE(dedupe_key, 'agent_replied:' || COALESCE(v_conversation_id, '') || ':' || COALESCE(v_message_id, ''));

    WHEN 'viewing_requested' THEN
      category := 'inquiry';
      title := 'New viewing request';
      body := 'A buyer requested a property viewing — review and confirm the slot.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_requested:' || COALESCE(v_viewing_id, v_conversation_id, ''));

    WHEN 'viewing_confirmed' THEN
      category := 'inquiry';
      title := 'Viewing confirmed';
      body := 'Your viewing time has been confirmed.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_confirmed:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_declined' THEN
      category := 'inquiry';
      title := 'Viewing declined';
      body := 'The agent could not accommodate this viewing request.';
      entity_type := 'viewing';
      entity_id := v_viewing_id;
      dedupe_key := COALESCE(dedupe_key, 'viewing_declined:' || COALESCE(v_viewing_id, ''));

    WHEN 'viewing_rescheduled' THEN
      category := 'inquiry';
      title := 'Viewing reschedule proposed';
      body := 'A new date or time was proposed for your viewing.';
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
      body := 'A conversation was moved to your archive.';
      entity_type := 'inquiry';
      entity_id := v_inquiry_id;
      dedupe_key := COALESCE(dedupe_key, 'inquiry_archived:' || COALESCE(v_inquiry_id, ''));

    ELSE
      dedupe_key := COALESCE(dedupe_key, p_event_type || ':' || md5(p_payload::text));
  END CASE;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_inquiry_with_conversation — sync preview on reused conversations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_inquiry_with_conversation(
  p_listing_id bigint,
  p_agent_user_id uuid,
  p_sender_user_id uuid DEFAULT NULL,
  p_sender_name text DEFAULT NULL,
  p_sender_email text DEFAULT NULL,
  p_sender_phone text DEFAULT NULL,
  p_inquiry_type text DEFAULT 'general',
  p_message text DEFAULT '',
  p_preferred_contact_method text DEFAULT 'email',
  p_quality_score smallint DEFAULT NULL,
  p_requested_date date DEFAULT NULL,
  p_requested_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_listing_owner uuid;
  v_sender_user_id uuid;
  v_inquiry_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_viewing_id uuid;
  v_now timestamptz;
  v_body text;
  v_channel text;
  v_pipeline text;
  v_existing_inquiry_id uuid;
BEGIN
  v_now := timezone('utc'::text, now());
  v_body := COALESCE(trim(p_message), '');

  IF p_listing_id IS NULL OR p_agent_user_id IS NULL THEN
    RAISE EXCEPTION 'listing_id and agent_user_id are required';
  END IF;

  IF v_body = '' AND p_inquiry_type <> 'schedule_viewing' THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  IF public.is_service_role_context() OR public.is_admin() THEN
    v_sender_user_id := p_sender_user_id;
    IF v_sender_user_id IS NULL THEN
      RAISE EXCEPTION 'authentication_required';
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    IF p_sender_user_id IS NOT NULL AND p_sender_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'sender_identity_mismatch';
    END IF;
    v_sender_user_id := auth.uid();
  ELSE
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT l.user_id INTO v_listing_owner
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND public.is_listing_engagement_enabled(l.status, l.lifecycle_status, l.moderation_status);

  IF v_listing_owner IS NULL THEN
    RAISE EXCEPTION 'listing not found or not publicly available';
  END IF;

  IF v_listing_owner <> p_agent_user_id THEN
    RAISE EXCEPTION 'agent_user_id does not match listing owner';
  END IF;

  v_channel := CASE p_inquiry_type
    WHEN 'schedule_viewing' THEN 'viewing'
    ELSE 'contact'
  END;

  v_pipeline := CASE p_inquiry_type
    WHEN 'schedule_viewing' THEN 'viewing_scheduled'
    ELSE 'new_inquiry'
  END;

  SELECT c.id, c.inquiry_id
  INTO v_conversation_id, v_existing_inquiry_id
  FROM public.conversations c
  WHERE c.listing_id = p_listing_id
    AND c.agent_id = p_agent_user_id
    AND COALESCE(c.status, 'open') = 'open'
    AND c.buyer_id = v_sender_user_id
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    v_inquiry_id := v_existing_inquiry_id;

    UPDATE public.conversations
    SET
      buyer_email = COALESCE(p_sender_email, buyer_email),
      buyer_name = COALESCE(p_sender_name, buyer_name),
      buyer_phone = COALESCE(p_sender_phone, buyer_phone),
      pipeline_stage = v_pipeline,
      stage = v_pipeline,
      last_message_at = CASE WHEN v_body <> '' THEN v_now ELSE last_message_at END,
      last_message_body = CASE WHEN v_body <> '' THEN v_body ELSE last_message_body END,
      last_message_role = CASE WHEN v_body <> '' THEN 'buyer' ELSE last_message_role END,
      buyer_unread = false,
      updated_at = v_now
    WHERE id = v_conversation_id;

    IF v_body <> '' THEN
      INSERT INTO public.messages (
        conversation_id, sender_id, sender_role, body, channel, created_at
      ) VALUES (
        v_conversation_id, v_sender_user_id, 'buyer', v_body, 'in_app', v_now
      )
      RETURNING id INTO v_message_id;
    END IF;

    INSERT INTO public.notification_queue (event_type, recipient_id, payload)
    VALUES (
      'new_inquiry',
      p_agent_user_id,
      jsonb_build_object(
        'inquiry_id', v_inquiry_id,
        'conversation_id', v_conversation_id,
        'listing_id', p_listing_id,
        'inquiry_type', p_inquiry_type,
        'message_id', v_message_id,
        'dedupe_key', 'buyer_message:' || v_conversation_id::text || ':' || COALESCE(v_message_id::text, v_now::text)
      )
    );

    RETURN jsonb_build_object(
      'inquiry_id', v_inquiry_id,
      'conversation_id', v_conversation_id,
      'message_id', v_message_id,
      'viewing_id', NULL,
      'reused_conversation', true
    );
  END IF;

  INSERT INTO public.conversations (
    listing_id, buyer_id, agent_id, buyer_email, buyer_name, buyer_phone,
    stage, pipeline_stage, status, last_message_at, last_message_body,
    last_message_role, buyer_unread, created_at, updated_at
  ) VALUES (
    p_listing_id, v_sender_user_id, p_agent_user_id, p_sender_email, p_sender_name, p_sender_phone,
    v_pipeline, v_pipeline, 'open', v_now,
    CASE WHEN v_body <> '' THEN v_body ELSE NULL END,
    CASE WHEN v_body <> '' THEN 'buyer' ELSE NULL END,
    false, v_now, v_now
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.listing_inquiries (
    listing_id, agent_user_id, listing_owner_id, sender_user_id, sender_id,
    sender_name, sender_email, sender_phone, channel, body, message,
    inquiry_type, preferred_contact_method, status, quality_score,
    conversation_id, pipeline_stage, created_at, updated_at
  ) VALUES (
    p_listing_id, p_agent_user_id, p_agent_user_id, v_sender_user_id, v_sender_user_id,
    p_sender_name, p_sender_email, p_sender_phone, v_channel, v_body, v_body,
    COALESCE(p_inquiry_type, 'general'), COALESCE(p_preferred_contact_method, 'email'),
    'new', p_quality_score, v_conversation_id, v_pipeline, v_now, v_now
  )
  RETURNING id INTO v_inquiry_id;

  UPDATE public.conversations SET inquiry_id = v_inquiry_id WHERE id = v_conversation_id;

  IF v_body <> '' THEN
    INSERT INTO public.messages (
      conversation_id, sender_id, sender_role, body, channel, created_at
    ) VALUES (
      v_conversation_id, v_sender_user_id, 'buyer', v_body, 'in_app', v_now
    )
    RETURNING id INTO v_message_id;
  END IF;

  IF p_inquiry_type = 'schedule_viewing' AND p_requested_date IS NOT NULL AND p_requested_time IS NOT NULL THEN
    INSERT INTO public.viewing_requests (
      listing_id, conversation_id, requester_id, requester_email, requester_name,
      agent_user_id, requested_date, requested_time, status, created_at, updated_at
    ) VALUES (
      p_listing_id, v_conversation_id, v_sender_user_id, p_sender_email, p_sender_name,
      p_agent_user_id, p_requested_date, p_requested_time, 'pending', v_now, v_now
    )
    RETURNING id INTO v_viewing_id;
  END IF;

  INSERT INTO public.notification_queue (event_type, recipient_id, payload)
  VALUES (
    'new_inquiry',
    p_agent_user_id,
    jsonb_build_object(
      'inquiry_id', v_inquiry_id,
      'conversation_id', v_conversation_id,
      'listing_id', p_listing_id,
      'inquiry_type', p_inquiry_type,
      'message_id', v_message_id,
      'viewing_id', v_viewing_id
    )
  );

  BEGIN
    PERFORM public.append_listing_event(
      p_listing_id, 'listing.crm.conversation_created', 'internal',
      jsonb_build_object('conversation_id', v_conversation_id, 'inquiry_id', v_inquiry_id, 'inquiry_type', p_inquiry_type),
      v_sender_user_id, 'buyer', 'app', v_inquiry_id, v_now
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'inquiry_id', v_inquiry_id,
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'viewing_id', v_viewing_id,
    'reused_conversation', false
  );
END;
$$;
