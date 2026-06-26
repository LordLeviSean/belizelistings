-- BelizeListings — Notification delivery (Phase 3 Milestone 3.6)
--
-- Layer 1: notification_queue (async pipeline, existing)
-- Layer 2: notifications (durable in-app inbox)
-- RPC deliver_notification + process_notification_queue_batch

-- ---------------------------------------------------------------------------
-- notifications — durable in-app inbox
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  queue_id uuid REFERENCES public.notification_queue (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.notifications IS
  'Durable in-app notification inbox. Delivered from notification_queue by SECURITY DEFINER RPCs.';

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_badge_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_unique
  ON public.notifications (recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (recipient_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own_read" ON public.notifications;
CREATE POLICY "notifications_update_own_read"
  ON public.notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Inserts via SECURITY DEFINER delivery RPC only

-- Realtime for NotificationCenter badge refresh
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Copy + dedupe helpers (mirrors src/lib/notifications/notificationCopyRegistry.js)
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

-- ---------------------------------------------------------------------------
-- deliver_notification — queue row → notifications inbox
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deliver_notification(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.notification_queue%ROWTYPE;
  v_category text;
  v_title text;
  v_body text;
  v_entity_type text;
  v_entity_id text;
  v_dedupe_key text;
  v_notification_id uuid;
  v_now timestamptz;
  v_result jsonb;
BEGIN
  v_now := timezone('utc'::text, now());

  SELECT * INTO v_row
  FROM public.notification_queue
  WHERE id = p_queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'queue_item_not_found');
  END IF;

  IF v_row.status IN ('sent', 'skipped') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'queue_id', p_queue_id,
      'status', v_row.status
    );
  END IF;

  IF v_row.recipient_id IS NULL THEN
    UPDATE public.notification_queue
    SET status = 'skipped', processed_at = v_now, attempts = v_row.attempts + 1
    WHERE id = p_queue_id;

    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_recipient');
  END IF;

  UPDATE public.notification_queue
  SET status = 'processing', attempts = v_row.attempts + 1
  WHERE id = p_queue_id;

  SELECT p.category, p.title, p.body, p.entity_type, p.entity_id, p.dedupe_key
  INTO v_category, v_title, v_body, v_entity_type, v_entity_id, v_dedupe_key
  FROM public.notification_presentation_for_event(v_row.event_type, v_row.payload) p
  LIMIT 1;

  INSERT INTO public.notifications (
    recipient_user_id,
    category,
    event_type,
    entity_type,
    entity_id,
    title,
    body,
    payload,
    dedupe_key,
    queue_id,
    created_at
  ) VALUES (
    v_row.recipient_id,
    v_category,
    v_row.event_type,
    v_entity_type,
    v_entity_id,
    v_title,
    v_body,
    v_row.payload,
    v_dedupe_key,
    p_queue_id,
    v_now
  )
  ON CONFLICT (recipient_user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    payload = EXCLUDED.payload,
    queue_id = EXCLUDED.queue_id
  RETURNING id INTO v_notification_id;

  UPDATE public.notification_queue
  SET status = 'sent', processed_at = v_now
  WHERE id = p_queue_id;

  v_result := jsonb_build_object(
    'ok', true,
    'queue_id', p_queue_id,
    'notification_id', v_notification_id,
    'recipient_id', v_row.recipient_id,
    'event_type', v_row.event_type,
    'dedupe_key', v_dedupe_key,
    'email_channel', 'skipped'
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.notification_queue
    SET status = 'failed', processed_at = v_now
    WHERE id = p_queue_id;

    RETURN jsonb_build_object(
      'ok', false,
      'queue_id', p_queue_id,
      'error', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_notification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deliver_notification(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deliver_notification(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- process_notification_queue_batch — drain pending queue
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_notification_queue_batch(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_limit int;
  v_ids uuid[];
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_processed int := 0;
  v_failed int := 0;
BEGIN
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));

  SELECT ARRAY_AGG(sub.id ORDER BY sub.scheduled_at ASC)
  INTO v_ids
  FROM (
    SELECT id, scheduled_at
    FROM public.notification_queue
    WHERE status = 'pending'
      AND scheduled_at <= timezone('utc'::text, now())
    ORDER BY scheduled_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ) sub;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'processed', 0, 'failed', 0, 'results', '[]'::jsonb);
  END IF;

  FOREACH v_id IN ARRAY v_ids
  LOOP
    v_one := public.deliver_notification(v_id);
    v_results := v_results || jsonb_build_array(v_one);

    IF COALESCE((v_one->>'ok')::boolean, false) THEN
      v_processed := v_processed + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'failed', v_failed,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_notification_queue_batch(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_notification_queue_batch(int) TO service_role;
