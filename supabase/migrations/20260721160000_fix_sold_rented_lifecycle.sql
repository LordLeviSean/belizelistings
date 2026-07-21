-- Repair sold/rented lifecycle: keep workflow status approved, closure on lifecycle_status.
-- Add 48-hour auto-archive RPC and lifecycle notification copy.

-- ---------------------------------------------------------------------------
-- Normalize any rows that incorrectly wrote closure into status
-- ---------------------------------------------------------------------------

UPDATE public.listings
SET
  status = 'approved',
  lifecycle_status = COALESCE(NULLIF(trim(lifecycle_status), ''), status),
  updated_at = timezone('utc'::text, now())
WHERE lower(COALESCE(status, '')) IN ('recently_sold', 'recently_rented');

-- ---------------------------------------------------------------------------
-- lifecycle_status constraint (status stays on listings_status_check)
-- ---------------------------------------------------------------------------

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_lifecycle_status_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_lifecycle_status_check
  CHECK (
    lifecycle_status IS NULL
    OR lower(lifecycle_status) = ANY (
      ARRAY[
        'draft',
        'pending',
        'submitted',
        'pending_review',
        'approved',
        'published',
        'verified',
        'recently_sold',
        'recently_rented',
        'archived',
        'rejected',
        'expired'
      ]::text[]
    )
  );

CREATE INDEX IF NOT EXISTS listings_closed_archive_eligible_idx
  ON public.listings (closed_at)
  WHERE lower(COALESCE(lifecycle_status, '')) IN ('recently_sold', 'recently_rented')
    AND lower(COALESCE(status, '')) <> 'archived';

-- ---------------------------------------------------------------------------
-- Visibility helpers — 48-hour recently closed window (UTC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_listing_recently_closed_public(
  p_status text,
  p_lifecycle_status text,
  p_sold_at timestamptz,
  p_rented_at timestamptz,
  p_closed_at timestamptz,
  p_now timestamptz DEFAULT timezone('utc'::text, now())
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    lower(COALESCE(p_status, '')) <> 'archived'
    AND public.listing_effective_lifecycle_key(p_status, p_lifecycle_status, NULL)
      IN ('recently_sold', 'recently_rented')
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at) IS NOT NULL
    AND COALESCE(p_closed_at, p_sold_at, p_rented_at)
      > (p_now - interval '48 hours');
$$;

COMMENT ON FUNCTION public.is_listing_recently_closed_public IS
  'Public browse window for sold/rented listings during the 48-hour post-close period.';

-- ---------------------------------------------------------------------------
-- archive_expired_closed_listings — idempotent 48-hour archival
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_expired_closed_listings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived integer := 0;
  v_row record;
BEGIN
  IF NOT public.is_service_role_context() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR v_row IN
    SELECT id, user_id, title, lifecycle_status, closed_at
    FROM public.listings
    WHERE lower(COALESCE(lifecycle_status, '')) IN ('recently_sold', 'recently_rented')
      AND lower(COALESCE(status, '')) <> 'archived'
      AND COALESCE(closed_at, sold_at, rented_at) IS NOT NULL
      AND COALESCE(closed_at, sold_at, rented_at)
        <= timezone('utc'::text, now()) - interval '48 hours'
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings
    SET
      status = 'archived',
      moderation_status = 'archived',
      updated_at = timezone('utc'::text, now())
    WHERE id = v_row.id;

    v_archived := v_archived + 1;

    PERFORM public.enqueue_notification_event(
      'listing_auto_archived',
      v_row.user_id,
      jsonb_build_object(
        'listing_id', v_row.id,
        'listing_title', v_row.title,
        'lifecycle_status', v_row.lifecycle_status,
        'dedupe_key', 'listing_auto_archived:' || v_row.id::text
      ),
      NULL
    );
  END LOOP;

  RETURN jsonb_build_object(
    'archived', v_archived,
    'skipped', 0,
    'ran_at', timezone('utc'::text, now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expired_closed_listings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_expired_closed_listings() TO service_role;

COMMENT ON FUNCTION public.archive_expired_closed_listings IS
  'Archives sold/rented listings 48+ hours after closed_at; preserves lifecycle outcome on lifecycle_status.';

-- Allow owners to enqueue lifecycle notifications; service role already bypasses auth checks.
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
  v_conversation_id uuid;
  v_viewing_id uuid;
  v_queue_id uuid;
  v_listing_id bigint;
BEGIN
  IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type_required';
  END IF;

  IF p_recipient_id IS NULL AND (p_recipient_email IS NULL OR trim(p_recipient_email) = '') THEN
    RAISE EXCEPTION 'recipient_required';
  END IF;

  IF v_actor IS NULL AND NOT v_service AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  v_conversation_id := NULLIF(COALESCE(p_payload->>'conversation_id', p_payload->>'conversationId'), '')::uuid;
  v_viewing_id := NULLIF(COALESCE(p_payload->>'viewing_id', p_payload->>'viewingId'), '')::uuid;
  v_listing_id := NULLIF(COALESCE(p_payload->>'listing_id', p_payload->>'listingId'), '')::bigint;

  IF NOT v_service AND NOT public.is_admin() THEN
    CASE p_event_type
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

-- Extend presentation matrix with lifecycle owner copy (retains CRM matrix from 20260714180000).
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
