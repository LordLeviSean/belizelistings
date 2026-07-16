-- Prevent self-contact on owned listings (inquiries + viewings) and remove invalid self-viewings.
-- Rollback: drop trigger/function; restore policies/RPC from 20260712140000.

-- ---------------------------------------------------------------------------
-- Data cleanup — self-viewings where requester is the listing owner/recipient
-- ---------------------------------------------------------------------------

WITH invalid_viewings AS (
  SELECT vr.id
  FROM public.viewing_requests vr
  INNER JOIN public.listings l ON l.id = vr.listing_id
  WHERE vr.requester_id IS NOT NULL
    AND vr.agent_user_id IS NOT NULL
    AND vr.requester_id = vr.agent_user_id
    AND vr.requester_id = l.user_id
),
deleted_queue AS (
  DELETE FROM public.notification_queue nq
  WHERE EXISTS (
    SELECT 1
    FROM invalid_viewings iv
    WHERE COALESCE(nq.payload->>'viewing_id', nq.payload->>'viewingId')::uuid = iv.id
  )
  RETURNING nq.id
),
deleted_notifications AS (
  DELETE FROM public.notifications n
  WHERE n.entity_type = 'viewing'
    AND n.entity_id IN (SELECT id::text FROM invalid_viewings)
  RETURNING n.id
)
DELETE FROM public.viewing_requests vr
WHERE vr.id IN (SELECT id FROM invalid_viewings);

-- ---------------------------------------------------------------------------
-- Viewing insert guard (direct client inserts + RPC inserts)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_self_viewing_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.requester_id IS NOT NULL
    AND NEW.agent_user_id IS NOT NULL
    AND NEW.requester_id = NEW.agent_user_id THEN
    RAISE EXCEPTION 'self_viewing_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS viewing_requests_prevent_self_contact ON public.viewing_requests;
CREATE TRIGGER viewing_requests_prevent_self_contact
  BEFORE INSERT ON public.viewing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_viewing_request();

-- ---------------------------------------------------------------------------
-- Authenticated inquiry insert policy — block sender = listing owner
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "listing_inquiries_insert_authenticated" ON public.listing_inquiries;
CREATE POLICY "listing_inquiries_insert_authenticated"
  ON public.listing_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (sender_user_id = auth.uid() OR sender_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.is_listing_engagement_enabled(l.status, l.lifecycle_status, l.moderation_status)
    )
    AND agent_user_id = (
      SELECT li.user_id FROM public.listings li WHERE li.id = listing_id LIMIT 1
    )
    AND sender_user_id IS DISTINCT FROM agent_user_id
    AND sender_id IS DISTINCT FROM agent_user_id
  );

DROP POLICY IF EXISTS "viewing_requests_insert_requester" ON public.viewing_requests;
CREATE POLICY "viewing_requests_insert_requester"
  ON public.viewing_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = auth.uid()
    AND requester_id IS DISTINCT FROM agent_user_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.is_listing_engagement_enabled(l.status, l.lifecycle_status, l.moderation_status)
    )
    AND agent_user_id = (
      SELECT li.user_id FROM public.listings li WHERE li.id = listing_id LIMIT 1
    )
  );

-- ---------------------------------------------------------------------------
-- create_inquiry_with_conversation — reject self-contact before any writes
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

  IF v_sender_user_id = v_listing_owner THEN
    RAISE EXCEPTION 'self_inquiry_not_allowed';
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

COMMENT ON FUNCTION public.create_inquiry_with_conversation IS
  'Atomic inquiry + conversation (+ optional viewing). Rejects self-contact on owned listings.';
