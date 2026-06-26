-- BelizeListings — Phase 3 Milestone 3.7 Marketplace Security (v1.6.7)
-- Guest inquiry rate limits, security_events audit table, notification RPC hardening.
-- Rollback: revert create_inquiry_with_conversation from 20260626160000; drop security_events.

-- ---------------------------------------------------------------------------
-- Indexes for guest rate-limit lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS listing_inquiries_sender_email_created_idx
  ON public.listing_inquiries (lower(trim(sender_email)), created_at DESC)
  WHERE sender_user_id IS NULL AND sender_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS listing_inquiries_listing_sender_created_idx
  ON public.listing_inquiries (listing_id, lower(trim(sender_email)), created_at DESC)
  WHERE sender_user_id IS NULL AND sender_email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- security_events — append-only API rejection / abuse audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'api',
  listing_id bigint REFERENCES public.listings (id) ON DELETE SET NULL,
  sender_email text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS security_events_type_created_idx
  ON public.security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_created_idx
  ON public.security_events (created_at DESC);

COMMENT ON TABLE public.security_events IS
  'Append-only security audit log (honeypot, captcha fail, rate limits). Service-role writes only.';

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_events_admin_select" ON public.security_events;
CREATE POLICY "security_events_admin_select"
  ON public.security_events FOR SELECT
  USING (public.is_admin());

-- No insert/update/delete policies for anon/authenticated — service role bypasses RLS.

-- ---------------------------------------------------------------------------
-- create_inquiry_with_conversation — guest rate limits (before insert)
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
  v_inquiry_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_viewing_id uuid;
  v_now timestamptz;
  v_body text;
  v_channel text;
  v_pipeline text;
  v_email_norm text;
  v_listing_count int;
  v_global_count int;
BEGIN
  v_now := timezone('utc'::text, now());
  v_body := COALESCE(trim(p_message), '');

  IF p_listing_id IS NULL OR p_agent_user_id IS NULL THEN
    RAISE EXCEPTION 'listing_id and agent_user_id are required';
  END IF;

  IF v_body = '' AND p_inquiry_type <> 'schedule_viewing' THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  SELECT l.user_id INTO v_listing_owner
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND (
      COALESCE(l.status, '') IN ('approved', 'published')
      OR COALESCE(l.lifecycle_status, '') IN ('approved', 'published')
      OR COALESCE(l.moderation_status, '') IN ('approved', 'published')
    );

  IF v_listing_owner IS NULL THEN
    RAISE EXCEPTION 'listing not found or not publicly available';
  END IF;

  IF v_listing_owner <> p_agent_user_id THEN
    RAISE EXCEPTION 'agent_user_id does not match listing owner';
  END IF;

  -- Guest rate limits (by normalized sender_email)
  IF p_sender_user_id IS NULL THEN
    IF p_sender_email IS NULL OR trim(p_sender_email) = '' THEN
      RAISE EXCEPTION 'sender_email is required for guest inquiries';
    END IF;

    v_email_norm := lower(trim(p_sender_email));

    SELECT COUNT(*)::int INTO v_listing_count
    FROM public.listing_inquiries li
    WHERE li.sender_user_id IS NULL
      AND lower(trim(li.sender_email)) = v_email_norm
      AND li.listing_id = p_listing_id
      AND li.created_at > v_now - interval '1 hour';

    IF v_listing_count >= 3 THEN
      RAISE EXCEPTION 'rate_limited_listing: maximum guest inquiries per listing per hour exceeded';
    END IF;

    SELECT COUNT(*)::int INTO v_global_count
    FROM public.listing_inquiries li
    WHERE li.sender_user_id IS NULL
      AND lower(trim(li.sender_email)) = v_email_norm
      AND li.created_at > v_now - interval '1 hour';

    IF v_global_count >= 10 THEN
      RAISE EXCEPTION 'rate_limited_global: maximum guest inquiries per hour exceeded';
    END IF;
  END IF;

  v_channel := CASE p_inquiry_type
    WHEN 'schedule_viewing' THEN 'viewing'
    ELSE 'contact'
  END;

  v_pipeline := CASE p_inquiry_type
    WHEN 'schedule_viewing' THEN 'viewing_scheduled'
    ELSE 'new_inquiry'
  END;

  INSERT INTO public.conversations (
    listing_id,
    buyer_id,
    agent_id,
    buyer_email,
    buyer_name,
    buyer_phone,
    stage,
    pipeline_stage,
    status,
    last_message_at,
    created_at,
    updated_at
  ) VALUES (
    p_listing_id,
    p_sender_user_id,
    p_agent_user_id,
    p_sender_email,
    p_sender_name,
    p_sender_phone,
    v_pipeline,
    v_pipeline,
    'open',
    v_now,
    v_now,
    v_now
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.listing_inquiries (
    listing_id,
    agent_user_id,
    listing_owner_id,
    sender_user_id,
    sender_id,
    sender_name,
    sender_email,
    sender_phone,
    channel,
    body,
    message,
    inquiry_type,
    preferred_contact_method,
    status,
    quality_score,
    conversation_id,
    pipeline_stage,
    created_at,
    updated_at
  ) VALUES (
    p_listing_id,
    p_agent_user_id,
    p_agent_user_id,
    p_sender_user_id,
    p_sender_user_id,
    p_sender_name,
    p_sender_email,
    p_sender_phone,
    v_channel,
    v_body,
    v_body,
    COALESCE(p_inquiry_type, 'general'),
    COALESCE(p_preferred_contact_method, 'email'),
    'new',
    p_quality_score,
    v_conversation_id,
    v_pipeline,
    v_now,
    v_now
  )
  RETURNING id INTO v_inquiry_id;

  UPDATE public.conversations
  SET inquiry_id = v_inquiry_id
  WHERE id = v_conversation_id;

  IF v_body <> '' THEN
    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      sender_role,
      body,
      channel,
      created_at
    ) VALUES (
      v_conversation_id,
      p_sender_user_id,
      'buyer',
      v_body,
      'in_app',
      v_now
    )
    RETURNING id INTO v_message_id;
  END IF;

  IF p_inquiry_type = 'schedule_viewing' AND p_requested_date IS NOT NULL AND p_requested_time IS NOT NULL THEN
    INSERT INTO public.viewing_requests (
      listing_id,
      conversation_id,
      requester_id,
      requester_email,
      requester_name,
      agent_user_id,
      requested_date,
      requested_time,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_listing_id,
      v_conversation_id,
      p_sender_user_id,
      p_sender_email,
      p_sender_name,
      p_agent_user_id,
      p_requested_date,
      p_requested_time,
      'pending',
      v_now,
      v_now
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
      'inquiry_type', p_inquiry_type
    )
  );

  BEGIN
    PERFORM public.append_listing_event(
      p_listing_id,
      'listing.crm.conversation_created',
      'internal',
      jsonb_build_object(
        'conversation_id', v_conversation_id,
        'inquiry_id', v_inquiry_id,
        'inquiry_type', p_inquiry_type
      ),
      p_sender_user_id,
      CASE WHEN p_sender_user_id IS NULL THEN 'guest' ELSE 'buyer' END,
      'app',
      v_inquiry_id,
      v_now
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'inquiry_id', v_inquiry_id,
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'viewing_id', v_viewing_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_inquiry_with_conversation IS
  'Atomic lead capture with guest rate limits (3/listing/hr, 10 global/hr by email).';

-- ---------------------------------------------------------------------------
-- Notification delivery hardening — service role only for batch/deliver RPCs
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.deliver_notification(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.process_notification_queue_batch(int) FROM authenticated;
