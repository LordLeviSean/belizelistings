-- Viewing workflow completion + per-participant soft archive (MVP v1)

-- viewing_requests: reschedule proposal + per-participant archive
ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS requester_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_date date,
  ADD COLUMN IF NOT EXISTS proposed_time time,
  ADD COLUMN IF NOT EXISTS message text;

COMMENT ON COLUMN public.viewing_requests.proposed_date IS
  'Counter-proposed date when status is rescheduled.';
COMMENT ON COLUMN public.viewing_requests.proposed_time IS
  'Counter-proposed time when status is rescheduled.';
COMMENT ON COLUMN public.viewing_requests.requester_archived_at IS
  'Soft-hide for buyer; does not affect agent view.';
COMMENT ON COLUMN public.viewing_requests.agent_archived_at IS
  'Soft-hide for listing owner/agent; does not affect buyer view.';

-- conversations: per-participant archive (preferred over global status for MVP)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS buyer_archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_archived_at timestamptz;

COMMENT ON COLUMN public.conversations.buyer_archived_at IS
  'Buyer-side soft archive; thread remains for agent.';
COMMENT ON COLUMN public.conversations.agent_archived_at IS
  'Agent-side soft archive; thread remains for buyer.';

-- Requester may cancel / request reschedule on own viewings
DROP POLICY IF EXISTS "viewing_requests_update_requester" ON public.viewing_requests;
CREATE POLICY "viewing_requests_update_requester"
  ON public.viewing_requests FOR UPDATE
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

-- Buyer may update own conversation (archive flag, read state)
DROP POLICY IF EXISTS "conversations_update_buyer" ON public.conversations;
CREATE POLICY "conversations_update_buyer"
  ON public.conversations FOR UPDATE
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());
