-- Agent upgrade request cycles — document row id as canonical cycle id and support history queries.

COMMENT ON COLUMN public.agent_upgrade_requests.id IS
  'Canonical upgrade_request_id / request cycle identifier — one row per submission cycle.';

COMMENT ON COLUMN public.agent_upgrade_requests.reviewed_at IS
  'Cycle resolution timestamp (resolved_at).';

COMMENT ON COLUMN public.agent_upgrade_requests.reviewed_by IS
  'Admin who resolved this cycle (resolved_by).';

CREATE INDEX IF NOT EXISTS agent_upgrade_requests_user_requested_at_idx
  ON public.agent_upgrade_requests (user_id, requested_at DESC);

-- Idempotent repair: if duplicate pending rows exist (should be blocked by partial unique index),
-- keep the newest pending row and resolve older duplicates as rejected historical cycles.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT user_id
    FROM public.agent_upgrade_requests
    WHERE status = 'pending'
    GROUP BY user_id
    HAVING count(*) > 1
  LOOP
    UPDATE public.agent_upgrade_requests aur
    SET
      status = 'rejected',
      reviewed_at = COALESCE(aur.reviewed_at, timezone('utc'::text, now())),
      updated_at = timezone('utc'::text, now())
    WHERE aur.user_id = r.user_id
      AND aur.status = 'pending'
      AND aur.id NOT IN (
        SELECT id
        FROM public.agent_upgrade_requests
        WHERE user_id = r.user_id AND status = 'pending'
        ORDER BY requested_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      );
  END LOOP;
END $$;
