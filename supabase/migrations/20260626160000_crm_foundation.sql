-- BelizeListings — Phase 3 Milestone 3.2 CRM Foundation (v1.6.0)
-- Workstreams A–G: listing_inquiries evolution, conversations, messages,
-- viewing_requests, notification_queue, create_inquiry_with_conversation RPC.
-- Rollback: drop new tables/functions; extended inquiry columns are additive.

-- ---------------------------------------------------------------------------
-- Workstream A — listing_inquiries (formalize + extend)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.listing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  sender_name text,
  sender_email text,
  sender_phone text,
  channel text NOT NULL DEFAULT 'contact',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  quality_score smallint,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Additive columns (non-breaking)
ALTER TABLE public.listing_inquiries
  ADD COLUMN IF NOT EXISTS listing_owner_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_contact_method text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS inquiry_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'new_inquiry',
  ADD COLUMN IF NOT EXISTS agent_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill owner/sender mirrors from legacy columns
UPDATE public.listing_inquiries
SET
  listing_owner_id = COALESCE(listing_owner_id, agent_user_id),
  sender_id = COALESCE(sender_id, sender_user_id),
  message = COALESCE(NULLIF(trim(message), ''), body),
  inquiry_type = CASE
    WHEN inquiry_type IS NOT NULL AND inquiry_type <> 'general' THEN inquiry_type
    WHEN channel = 'viewing' THEN 'schedule_viewing'
    WHEN channel = 'question' THEN 'general'
    ELSE 'general'
  END
WHERE listing_owner_id IS NULL
   OR sender_id IS NULL
   OR message IS NULL
   OR inquiry_type = 'general';

-- Expand status check (keep legacy values)
ALTER TABLE public.listing_inquiries DROP CONSTRAINT IF EXISTS listing_inquiries_status_check;
ALTER TABLE public.listing_inquiries
  ADD CONSTRAINT listing_inquiries_status_check
  CHECK (status IN ('new', 'opened', 'responded', 'closed', 'archived', 'scheduled'));

ALTER TABLE public.listing_inquiries DROP CONSTRAINT IF EXISTS listing_inquiries_inquiry_type_check;
ALTER TABLE public.listing_inquiries
  ADD CONSTRAINT listing_inquiries_inquiry_type_check
  CHECK (inquiry_type IN ('general', 'schedule_viewing', 'make_offer', 'rental', 'purchase'));

CREATE INDEX IF NOT EXISTS listing_inquiries_agent_created_idx
  ON public.listing_inquiries (agent_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_inquiries_listing_idx
  ON public.listing_inquiries (listing_id);

CREATE INDEX IF NOT EXISTS listing_inquiries_conversation_idx
  ON public.listing_inquiries (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_inquiries_select_agent" ON public.listing_inquiries;
CREATE POLICY "listing_inquiries_select_agent"
  ON public.listing_inquiries FOR SELECT
  USING (agent_user_id = auth.uid() OR listing_owner_id = auth.uid());

DROP POLICY IF EXISTS "listing_inquiries_select_sender" ON public.listing_inquiries;
CREATE POLICY "listing_inquiries_select_sender"
  ON public.listing_inquiries FOR SELECT
  USING (
    (sender_user_id IS NOT NULL AND sender_user_id = auth.uid())
    OR (sender_id IS NOT NULL AND sender_id = auth.uid())
  );

DROP POLICY IF EXISTS "listing_inquiries_insert_public_listing" ON public.listing_inquiries;
CREATE POLICY "listing_inquiries_insert_public_listing"
  ON public.listing_inquiries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_id
        AND (
          COALESCE(l.status, '') IN ('approved', 'published')
          OR COALESCE(l.lifecycle_status, '') IN ('approved', 'published')
          OR COALESCE(l.moderation_status, '') IN ('approved', 'published')
        )
    )
    AND agent_user_id = (
      SELECT li.user_id FROM public.listings li WHERE li.id = listing_id LIMIT 1
    )
  );

DROP POLICY IF EXISTS "listing_inquiries_update_agent" ON public.listing_inquiries;
CREATE POLICY "listing_inquiries_update_agent"
  ON public.listing_inquiries FOR UPDATE
  USING (agent_user_id = auth.uid() OR listing_owner_id = auth.uid())
  WITH CHECK (agent_user_id = auth.uid() OR listing_owner_id = auth.uid());

COMMENT ON TABLE public.listing_inquiries IS
  'Public listing inquiries / leads routed to listing owner agent.';

-- ---------------------------------------------------------------------------
-- Workstream B — conversations + messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES public.listing_inquiries (id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  agent_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  buyer_email text,
  buyer_name text,
  buyer_phone text,
  stage text NOT NULL DEFAULT 'new_inquiry',
  pipeline_stage text NOT NULL DEFAULT 'new_inquiry',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS conversations_agent_updated_idx
  ON public.conversations (agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversations_buyer_updated_idx
  ON public.conversations (buyer_id, updated_at DESC)
  WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_listing_idx
  ON public.conversations (listing_id);

ALTER TABLE public.listing_inquiries
  DROP CONSTRAINT IF EXISTS listing_inquiries_conversation_id_fkey;
ALTER TABLE public.listing_inquiries
  ADD CONSTRAINT listing_inquiries_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('buyer', 'agent', 'system')),
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'whatsapp', 'sms', 'system')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at ASC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  USING (
    agent_id = auth.uid()
    OR buyer_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "conversations_update_agent" ON public.conversations;
CREATE POLICY "conversations_update_agent"
  ON public.conversations FOR UPDATE
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.agent_id = auth.uid() OR c.buyer_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          (sender_role = 'agent' AND c.agent_id = auth.uid())
          OR (sender_role = 'buyer' AND (c.buyer_id = auth.uid() OR c.buyer_id IS NULL))
          OR public.is_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Workstream C — viewing_requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations (id) ON DELETE SET NULL,
  requester_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  requester_email text,
  requester_name text,
  agent_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Belize',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'declined')),
  confirmed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS viewing_requests_agent_status_idx
  ON public.viewing_requests (agent_user_id, status, requested_date);

CREATE INDEX IF NOT EXISTS viewing_requests_requester_idx
  ON public.viewing_requests (requester_id, requested_date DESC)
  WHERE requester_id IS NOT NULL;

ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viewing_requests_select_participant" ON public.viewing_requests;
CREATE POLICY "viewing_requests_select_participant"
  ON public.viewing_requests FOR SELECT
  USING (
    agent_user_id = auth.uid()
    OR requester_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "viewing_requests_insert_requester" ON public.viewing_requests;
CREATE POLICY "viewing_requests_insert_requester"
  ON public.viewing_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND (
          COALESCE(l.status, '') IN ('approved', 'published')
          OR COALESCE(l.lifecycle_status, '') IN ('approved', 'published')
        )
    )
  );

DROP POLICY IF EXISTS "viewing_requests_update_agent" ON public.viewing_requests;
CREATE POLICY "viewing_requests_update_agent"
  ON public.viewing_requests FOR UPDATE
  USING (agent_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (agent_user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- Workstream G — notification_queue (infrastructure only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  recipient_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts smallint NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS notification_queue_pending_idx
  ON public.notification_queue (status, scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_queue_select_own" ON public.notification_queue;
CREATE POLICY "notification_queue_select_own"
  ON public.notification_queue FOR SELECT
  USING (recipient_id = auth.uid() OR public.is_admin());

-- Inserts via SECURITY DEFINER RPC only

-- ---------------------------------------------------------------------------
-- RPC — atomic inquiry + conversation + first message (+ optional viewing)
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

  -- Notification queue (Workstream G)
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

  -- Internal listing event (best-effort)
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
  'Atomic lead capture: inquiry + conversation + first message (+ optional viewing request).';

REVOKE ALL ON FUNCTION public.create_inquiry_with_conversation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inquiry_with_conversation TO anon;
GRANT EXECUTE ON FUNCTION public.create_inquiry_with_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_inquiry_with_conversation TO service_role;
