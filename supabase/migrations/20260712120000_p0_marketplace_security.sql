-- P0 marketplace security: CRM identity, moderation boundaries, public RLS, notifications.
-- Revalidates post-74e578e published-edit architecture; does not alter edit access helpers.

-- ---------------------------------------------------------------------------
-- Context helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_service_role_context()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role',
    current_user IN ('service_role', 'postgres', 'supabase_admin')
  );
$$;

COMMENT ON FUNCTION public.is_service_role_context() IS
  'True when the current session is service_role or equivalent elevated DB role.';

REVOKE ALL ON FUNCTION public.is_service_role_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role_context() TO service_role;

-- ---------------------------------------------------------------------------
-- Canonical listing visibility predicates (mirror src/utils/canonicalListing.js)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.listing_effective_lifecycle_key(
  p_status text,
  p_lifecycle_status text,
  p_moderation_status text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_status, '')) = 'archived'
      OR lower(COALESCE(p_lifecycle_status, '')) = 'archived'
      OR lower(COALESCE(p_moderation_status, '')) = 'archived' THEN 'archived'
    WHEN lower(COALESCE(p_status, '')) = 'rejected'
      OR lower(COALESCE(p_lifecycle_status, '')) = 'rejected'
      OR lower(COALESCE(p_moderation_status, '')) = 'rejected' THEN 'rejected'
    WHEN lower(COALESCE(p_status, '')) IN ('pending', 'pending_review')
      OR lower(COALESCE(p_moderation_status, '')) = 'pending_review'
      OR lower(COALESCE(p_lifecycle_status, '')) IN ('submitted', 'pending', 'pending_review') THEN 'pending'
    WHEN lower(COALESCE(p_lifecycle_status, '')) IN ('approved', 'published') THEN 'approved'
    WHEN lower(COALESCE(p_status, '')) IN ('approved', 'published') THEN 'approved'
    WHEN lower(COALESCE(p_lifecycle_status, '')) <> '' THEN lower(p_lifecycle_status)
    ELSE lower(COALESCE(p_status, 'draft'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_listing_active_inventory(
  p_status text,
  p_lifecycle_status text,
  p_moderation_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.listing_effective_lifecycle_key(p_status, p_lifecycle_status, p_moderation_status) = 'approved';
$$;

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
    public.listing_effective_lifecycle_key(p_status, p_lifecycle_status, NULL)
      IN ('recently_sold', 'recently_rented')
    AND COALESCE(p_sold_at, p_rented_at, p_closed_at) IS NOT NULL
    AND COALESCE(p_sold_at, p_rented_at, p_closed_at) > (p_now - interval '30 days');
$$;

CREATE OR REPLACE FUNCTION public.is_listing_publicly_browsable(
  p_status text,
  p_lifecycle_status text,
  p_moderation_status text,
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
    public.is_listing_active_inventory(p_status, p_lifecycle_status, p_moderation_status)
    OR public.is_listing_recently_closed_public(
      p_status,
      p_lifecycle_status,
      p_sold_at,
      p_rented_at,
      p_closed_at,
      p_now
    );
$$;

CREATE OR REPLACE FUNCTION public.is_listing_engagement_enabled(
  p_status text,
  p_lifecycle_status text,
  p_moderation_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_listing_active_inventory(p_status, p_lifecycle_status, p_moderation_status);
$$;

COMMENT ON FUNCTION public.is_listing_publicly_browsable IS
  'Public browse/search/detail visibility: published OR recently closed within 30 days.';
COMMENT ON FUNCTION public.is_listing_engagement_enabled IS
  'New messages/viewings allowed only on active published inventory.';

-- ---------------------------------------------------------------------------
-- Public SELECT policy — include recently sold/rented display window
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can view approved listings" ON public.listings;
DROP POLICY IF EXISTS "Public can view approved + own" ON public.listings;
DROP POLICY IF EXISTS "Public read approved listings" ON public.listings;

CREATE POLICY "Public can view browsable listings"
  ON public.listings FOR SELECT
  TO anon, authenticated
  USING (
    public.is_listing_publicly_browsable(
      status,
      lifecycle_status,
      moderation_status,
      sold_at,
      rented_at,
      closed_at
    )
  );

-- ---------------------------------------------------------------------------
-- Owner moderation boundary — owners/agents cannot self-approve or re-attribute
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_listing_owner_moderation_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old_lc text;
  v_new_lc text;
BEGIN
  IF public.is_admin() OR public.is_service_role_context() THEN
    RETURN NEW;
  END IF;

  IF v_caller IS NULL OR v_caller IS DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'ownership_immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.listed_by IS DISTINCT FROM OLD.listed_by
     OR NEW.managed_by IS DISTINCT FROM OLD.managed_by
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
    RAISE EXCEPTION 'attribution_immutable' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.verification_status, '') = 'verified'
     AND COALESCE(OLD.verification_status, '') IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'owner_cannot_self_verify' USING ERRCODE = '42501';
  END IF;

  v_old_lc := public.listing_effective_lifecycle_key(OLD.status, OLD.lifecycle_status, OLD.moderation_status);
  v_new_lc := public.listing_effective_lifecycle_key(NEW.status, NEW.lifecycle_status, NEW.moderation_status);

  -- Allow mark sold/rented from published inventory
  IF v_old_lc = 'approved'
     AND v_new_lc IN ('recently_sold', 'recently_rented') THEN
    RETURN NEW;
  END IF;

  -- Allow resubmit / restore to pending queue
  IF v_new_lc = 'pending'
     AND v_old_lc IN ('draft', 'rejected', 'archived', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Allow content edits without lifecycle escalation
  IF v_old_lc IN ('approved', 'recently_sold', 'recently_rented')
     AND v_new_lc = v_old_lc THEN
    RETURN NEW;
  END IF;

  IF v_old_lc IN ('draft', 'rejected', 'archived')
     AND v_new_lc IN ('draft', 'rejected', 'archived') THEN
    RETURN NEW;
  END IF;

  -- Block self-approval / moderation bypass
  IF COALESCE(NEW.moderation_status, '') = 'approved'
     AND COALESCE(OLD.moderation_status, '') IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'owner_cannot_self_approve' USING ERRCODE = '42501';
  END IF;

  IF (
    COALESCE(NEW.status, '') IN ('approved', 'published')
    OR COALESCE(NEW.lifecycle_status, '') IN ('approved', 'published')
  ) AND v_old_lc NOT IN ('approved', 'recently_sold', 'recently_rented') THEN
    RAISE EXCEPTION 'owner_cannot_self_approve' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_owner_moderation_boundary ON public.listings;
CREATE TRIGGER listings_owner_moderation_boundary
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_listing_owner_moderation_boundary();

COMMENT ON FUNCTION public.enforce_listing_owner_moderation_boundary IS
  'Owners may edit content and resubmit/mark closed; cannot self-approve, verify, or change attribution.';

-- ---------------------------------------------------------------------------
-- CRM INSERT policies — require authenticated sender/requester ownership
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          (sender_role = 'agent' AND c.agent_id = auth.uid())
          OR (sender_role = 'buyer' AND c.buyer_id = auth.uid())
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "viewing_requests_insert_requester" ON public.viewing_requests;
CREATE POLICY "viewing_requests_insert_requester"
  ON public.viewing_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND public.is_listing_engagement_enabled(l.status, l.lifecycle_status, l.moderation_status)
    )
    AND agent_user_id = (
      SELECT li.user_id FROM public.listings li WHERE li.id = listing_id LIMIT 1
    )
  );

DROP POLICY IF EXISTS "listing_inquiries_insert_public_listing" ON public.listing_inquiries;
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
  );

-- ---------------------------------------------------------------------------
-- Secure notification enqueue — no direct client INSERT to notification_queue
-- ---------------------------------------------------------------------------

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

  IF NOT v_service AND NOT public.is_admin() THEN
    CASE p_event_type
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
          WHERE c.id = v_conversation_id
            AND c.buyer_id = v_actor
        ) THEN
          RAISE EXCEPTION 'forbidden';
        END IF;
        IF p_recipient_id IS DISTINCT FROM (
          SELECT c.agent_id FROM public.conversations c WHERE c.id = v_conversation_id LIMIT 1
        ) THEN
          RAISE EXCEPTION 'invalid_recipient';
        END IF;

      WHEN 'viewing_requested', 'viewing_confirmed', 'viewing_declined',
           'viewing_rescheduled', 'viewing_cancelled' THEN
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

COMMENT ON FUNCTION public.enqueue_notification_event IS
  'Canonical server-controlled notification queue insert. Validates actor + recipient membership.';

REVOKE ALL ON FUNCTION public.enqueue_notification_event(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(text, uuid, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- create_inquiry_with_conversation — enforce sender identity; auth-only CRM
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
  v_listing_status text;
  v_listing_lifecycle text;
  v_listing_moderation text;
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
  v_is_new_conversation boolean := false;
BEGIN
  v_now := timezone('utc'::text, now());
  v_body := COALESCE(trim(p_message), '');

  IF p_listing_id IS NULL OR p_agent_user_id IS NULL THEN
    RAISE EXCEPTION 'listing_id and agent_user_id are required';
  END IF;

  IF v_body = '' AND p_inquiry_type <> 'schedule_viewing' THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  -- Derive trusted sender identity (never trust client spoofing)
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

  SELECT l.user_id, l.status, l.lifecycle_status, l.moderation_status
  INTO v_listing_owner, v_listing_status, v_listing_lifecycle, v_listing_moderation
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
      updated_at = v_now
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
        v_sender_user_id,
        'buyer',
        v_body,
        'in_app',
        v_now
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

  v_is_new_conversation := true;

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
    last_message_body,
    last_message_role,
    buyer_unread,
    created_at,
    updated_at
  ) VALUES (
    p_listing_id,
    v_sender_user_id,
    p_agent_user_id,
    p_sender_email,
    p_sender_name,
    p_sender_phone,
    v_pipeline,
    v_pipeline,
    'open',
    v_now,
    NULL,
    NULL,
    false,
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
    v_sender_user_id,
    v_sender_user_id,
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
      v_sender_user_id,
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
      v_sender_user_id,
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
      'inquiry_type', p_inquiry_type,
      'message_id', v_message_id
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
      v_sender_user_id,
      'buyer',
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
    'viewing_id', v_viewing_id,
    'reused_conversation', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_inquiry_with_conversation IS
  'Atomic authenticated lead capture; reuses open buyer+listing conversation; rejects sender spoofing.';

REVOKE ALL ON FUNCTION public.create_inquiry_with_conversation(
  bigint, uuid, uuid, text, text, text, text, text, text, smallint, date, time
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_inquiry_with_conversation(
  bigint, uuid, uuid, text, text, text, text, text, text, smallint, date, time
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_inquiry_with_conversation(
  bigint, uuid, uuid, text, text, text, text, text, text, smallint, date, time
) TO service_role;
