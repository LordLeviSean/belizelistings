-- Agent upgrade submission — durable in-app notifications for requester and admins.

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
  v_upgrade_request_id text;
  v_requester_name text;
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
  v_upgrade_request_id := COALESCE(p_payload->>'upgrade_request_id', p_payload->>'upgradeRequestId');
  v_requester_name := COALESCE(
    NULLIF(trim(p_payload->>'requester_name'), ''),
    NULLIF(trim(p_payload->>'requesterName'), ''),
    NULLIF(trim(p_payload->>'username'), ''),
    'A user'
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
    WHEN 'agent_upgrade_submitted' THEN
      category := 'guidance';
      title := 'Agent upgrade request submitted';
      body := 'Your request for Agent access is now awaiting review.';
      entity_type := 'agent_upgrade_request';
      entity_id := v_upgrade_request_id;
      dedupe_key := COALESCE(dedupe_key, 'agent_upgrade_submitted:' || COALESCE(v_upgrade_request_id, ''));

    WHEN 'agent_upgrade_requested' THEN
      category := 'moderation';
      title := 'New Agent upgrade request';
      body := v_requester_name || ' has requested Agent access.';
      entity_type := 'agent_upgrade_request';
      entity_id := v_upgrade_request_id;
      dedupe_key := COALESCE(dedupe_key, 'agent_upgrade_requested:' || COALESCE(v_upgrade_request_id, ''));

    WHEN 'listing_approved' THEN
      category := 'moderation';
      title := 'Listing approved';
      body := v_listing_title || ' is now live on BelizeListings.';
      entity_type := 'listing';
      entity_id := v_listing_id;
      dedupe_key := COALESCE(dedupe_key, 'listing_approved:' || COALESCE(v_listing_id, ''));

    WHEN 'listing_rejected' THEN
      category := 'moderation';
      title := 'Listing needs revision';
      body := v_listing_title || ' was not approved. Review and edit it before resubmitting.';
      entity_type := 'listing';
      entity_id := v_listing_id;
      dedupe_key := COALESCE(dedupe_key, 'listing_rejected:' || COALESCE(v_listing_id, ''));

    WHEN 'listing_marked_sold' THEN
      category := 'listing_event';
      title := 'Listing marked as sold';
      body := v_listing_title || ' will be archived automatically in 48 hours.';
      entity_type := 'listing';
      entity_id := v_listing_id;
      dedupe_key := COALESCE(dedupe_key, 'listing_marked_sold:' || COALESCE(v_listing_id, ''));

    WHEN 'listing_marked_rented' THEN
      category := 'listing_event';
      title := 'Listing marked as rented';
      body := v_listing_title || ' will be archived automatically in 48 hours.';
      entity_type := 'listing';
      entity_id := v_listing_id;
      dedupe_key := COALESCE(dedupe_key, 'listing_marked_rented:' || COALESCE(v_listing_id, ''));

    WHEN 'listing_auto_archived' THEN
      category := 'listing_event';
      title := 'Listing archived';
      body := 'Your closed listing has been archived.';
      entity_type := 'listing';
      entity_id := v_listing_id;
      dedupe_key := COALESCE(dedupe_key, 'listing_auto_archived:' || COALESCE(v_listing_id, ''));

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

-- Extend enqueue auth for agent upgrade submission events.
CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_event_type text,
  p_recipient_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_recipient_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_service boolean := public.is_service_role_context();
  v_internal boolean := current_setting('bl.upgrade_notification_internal', true) = '1';
  v_conversation_id uuid;
  v_viewing_id uuid;
  v_queue_id uuid;
  v_listing_id bigint;
  v_upgrade_request_id uuid;
BEGIN
  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;

  IF p_recipient_id IS NULL AND (p_recipient_email IS NULL OR trim(p_recipient_email) = '') THEN
    RAISE EXCEPTION 'recipient_required';
  END IF;

  IF v_actor IS NULL AND NOT v_service AND NOT public.is_admin() AND NOT v_internal THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_conversation_id := NULLIF(COALESCE(p_payload->>'conversation_id', p_payload->>'conversationId'), '')::uuid;
  v_viewing_id := NULLIF(COALESCE(p_payload->>'viewing_id', p_payload->>'viewingId'), '')::uuid;
  v_listing_id := NULLIF(COALESCE(p_payload->>'listing_id', p_payload->>'listingId'), '')::bigint;
  v_upgrade_request_id := NULLIF(COALESCE(p_payload->>'upgrade_request_id', p_payload->>'upgradeRequestId'), '')::uuid;

  IF NOT v_service AND NOT public.is_admin() AND NOT v_internal THEN
    CASE p_event_type
      WHEN 'agent_upgrade_submitted' THEN
        IF p_recipient_id IS DISTINCT FROM v_actor THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;
        IF v_upgrade_request_id IS NULL OR NOT EXISTS (
          SELECT 1
          FROM public.agent_upgrade_requests aur
          WHERE aur.id = v_upgrade_request_id
            AND aur.user_id = v_actor
            AND aur.status = 'pending'
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;

      WHEN 'agent_upgrade_requested' THEN
        RAISE EXCEPTION 'forbidden';

      WHEN 'listing_marked_sold', 'listing_marked_rented' THEN
        IF p_recipient_id IS DISTINCT FROM v_actor THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;
        IF v_listing_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.listings l WHERE l.id = v_listing_id AND l.user_id = v_actor
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;

      WHEN 'agent_replied' THEN
        IF v_conversation_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = v_conversation_id AND c.agent_id = v_actor
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;
        IF p_recipient_id IS DISTINCT FROM (
          SELECT c.buyer_id FROM public.conversations c WHERE c.id = v_conversation_id LIMIT 1
        ) THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;

      WHEN 'new_inquiry' THEN
        IF v_conversation_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = v_conversation_id AND c.buyer_id = v_actor
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;
        IF p_recipient_id IS DISTINCT FROM (
          SELECT c.agent_id FROM public.conversations c WHERE c.id = v_conversation_id LIMIT 1
        ) THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;

      WHEN 'viewing_requested', 'viewing_confirmed', 'viewing_declined',
           'viewing_rescheduled', 'viewing_cancelled', 'viewing_completed' THEN
        IF v_viewing_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.viewing_requests vr
          WHERE vr.id = v_viewing_id
            AND (vr.agent_user_id = v_actor OR vr.requester_id = v_actor)
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM public.viewing_requests vr
          WHERE vr.id = v_viewing_id
            AND (
              (vr.agent_user_id = v_actor AND vr.requester_id = p_recipient_id)
              OR (vr.requester_id = v_actor AND vr.agent_user_id = p_recipient_id)
            )
        ) THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;

      ELSE
        RAISE EXCEPTION 'forbidden';
    END CASE;
  END IF;

  INSERT INTO public.notification_queue (
    event_type,
    recipient_id,
    recipient_email,
    payload,
    status,
    scheduled_at
  ) VALUES (
    p_event_type,
    p_recipient_id,
    p_recipient_email,
    COALESCE(p_payload, '{}'::jsonb),
    'pending',
    timezone('utc'::text, now())
  )
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object('ok', true, 'queue_id', v_queue_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_agent_upgrade_request(
  p_username text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_queue_id uuid;
  v_admin record;
  v_display_name text;
  v_payload jsonb;
  v_enqueue jsonb;
  v_row public.agent_upgrade_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND COALESCE(p.role, 'user') = 'user'
  ) THEN
    RAISE EXCEPTION 'role_ineligible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agent_upgrade_requests aur
    WHERE aur.user_id = v_user_id
      AND aur.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'duplicate_pending_request' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.agent_upgrade_requests (
    user_id,
    username,
    email,
    current_user_role,
    requested_user_role,
    status
  ) VALUES (
    v_user_id,
    NULLIF(trim(p_username), ''),
    NULLIF(lower(trim(p_email)), ''),
    'user',
    'agent',
    'pending'
  )
  RETURNING * INTO v_row;

  v_request_id := v_row.id;
  v_display_name := COALESCE(
    NULLIF(trim(p_username), ''),
    NULLIF(trim(p_email), ''),
    'A user'
  );

  PERFORM set_config('bl.upgrade_notification_internal', '1', true);

  v_payload := jsonb_build_object(
    'upgrade_request_id', v_request_id,
    'dedupe_key', 'agent_upgrade_submitted:' || v_request_id::text
  );
  v_enqueue := public.enqueue_notification_event('agent_upgrade_submitted', v_user_id, v_payload);
  v_queue_id := NULLIF(v_enqueue->>'queue_id', '')::uuid;
  IF v_queue_id IS NOT NULL THEN
    PERFORM public.deliver_notification(v_queue_id);
  END IF;

  FOR v_admin IN
    SELECT p.id
    FROM public.profiles p
    WHERE lower(COALESCE(p.role, '')) = 'admin'
  LOOP
    v_payload := jsonb_build_object(
      'upgrade_request_id', v_request_id,
      'requester_name', v_display_name,
      'dedupe_key', 'agent_upgrade_requested:' || v_request_id::text
    );
    v_enqueue := public.enqueue_notification_event('agent_upgrade_requested', v_admin.id, v_payload);
    v_queue_id := NULLIF(v_enqueue->>'queue_id', '')::uuid;
    IF v_queue_id IS NOT NULL THEN
      PERFORM public.deliver_notification(v_queue_id);
    END IF;
  END LOOP;

  PERFORM set_config('bl.upgrade_notification_internal', '0', true);

  RETURN jsonb_build_object(
    'ok', true,
    'upgrade_request_id', v_request_id,
    'cycle_id', v_request_id,
    'request', to_jsonb(v_row)
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('bl.upgrade_notification_internal', '0', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_agent_upgrade_request(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_agent_upgrade_request(text, text) TO authenticated;
