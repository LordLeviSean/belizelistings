-- Per-participant permanent delete for conversations and viewing requests.
-- One participant's delete must not remove the other participant's history.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS buyer_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_deleted_at timestamptz;

COMMENT ON COLUMN public.conversations.buyer_deleted_at IS
  'Buyer-side permanent delete; hidden from buyer forever; agent copy unaffected.';
COMMENT ON COLUMN public.conversations.agent_deleted_at IS
  'Agent/owner-side permanent delete; hidden from owner forever; buyer copy unaffected.';

ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS requester_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_deleted_at timestamptz;

COMMENT ON COLUMN public.viewing_requests.requester_deleted_at IS
  'Buyer-side permanent delete; hidden from requester forever.';
COMMENT ON COLUMN public.viewing_requests.agent_deleted_at IS
  'Owner/agent-side permanent delete; hidden from listing contact forever.';

-- Physically remove row only when every participant has deleted their side.
CREATE OR REPLACE FUNCTION public.maybe_purge_fully_deleted_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.buyer_deleted_at IS NOT NULL AND NEW.agent_deleted_at IS NOT NULL THEN
    DELETE FROM public.conversations WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_purge_fully_deleted ON public.conversations;
CREATE TRIGGER conversations_purge_fully_deleted
  AFTER UPDATE OF buyer_deleted_at, agent_deleted_at ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_purge_fully_deleted_conversation();

CREATE OR REPLACE FUNCTION public.maybe_purge_fully_deleted_viewing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_deleted_at IS NOT NULL AND NEW.agent_deleted_at IS NOT NULL THEN
    DELETE FROM public.viewing_requests WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS viewing_requests_purge_fully_deleted ON public.viewing_requests;
CREATE TRIGGER viewing_requests_purge_fully_deleted
  AFTER UPDATE OF requester_deleted_at, agent_deleted_at ON public.viewing_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.maybe_purge_fully_deleted_viewing();

-- Secure participant-bound delete (auth.uid() only — never trust client participant id).
CREATE OR REPLACE FUNCTION public.participant_delete_conversation(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'conversation_id_required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id AND c.buyer_id = v_actor
  ) THEN
    UPDATE public.conversations
    SET buyer_deleted_at = v_now, updated_at = v_now
    WHERE id = p_conversation_id AND buyer_id = v_actor;
    RETURN jsonb_build_object('ok', true, 'side', 'buyer');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id AND c.agent_id = v_actor
  ) THEN
    UPDATE public.conversations
    SET agent_deleted_at = v_now, updated_at = v_now
    WHERE id = p_conversation_id AND agent_id = v_actor;
    RETURN jsonb_build_object('ok', true, 'side', 'agent');
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$$;

CREATE OR REPLACE FUNCTION public.participant_delete_viewing(p_viewing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_viewing_id IS NULL THEN
    RAISE EXCEPTION 'viewing_id_required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.viewing_requests vr
    WHERE vr.id = p_viewing_id AND vr.requester_id = v_actor
  ) THEN
    UPDATE public.viewing_requests
    SET requester_deleted_at = v_now, updated_at = v_now
    WHERE id = p_viewing_id AND requester_id = v_actor;
    RETURN jsonb_build_object('ok', true, 'side', 'requester');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.viewing_requests vr
    WHERE vr.id = p_viewing_id AND vr.agent_user_id = v_actor
  ) THEN
    UPDATE public.viewing_requests
    SET agent_deleted_at = v_now, updated_at = v_now
    WHERE id = p_viewing_id AND agent_user_id = v_actor;
    RETURN jsonb_build_object('ok', true, 'side', 'agent');
  END IF;

  RAISE EXCEPTION 'forbidden';
END;
$$;

REVOKE ALL ON FUNCTION public.participant_delete_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.participant_delete_viewing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participant_delete_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.participant_delete_viewing(uuid) TO authenticated;
