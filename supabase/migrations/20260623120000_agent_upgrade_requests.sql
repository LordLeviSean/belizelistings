-- BelizeListings — agent upgrade request queue (user → agent role promotion).
--
-- Users submit pending requests; admins approve/reject via dashboard RLS.
-- Requires public.is_admin() from profiles_admin_rls migrations.

CREATE TABLE IF NOT EXISTS public.agent_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text,
  email text,
  requested_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  current_user_role text NOT NULL DEFAULT 'user',
  requested_user_role text NOT NULL DEFAULT 'agent',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.agent_upgrade_requests IS
  'Queue for platform users requesting Agent role; one pending row per user.';

CREATE UNIQUE INDEX IF NOT EXISTS agent_upgrade_requests_one_pending_per_user
  ON public.agent_upgrade_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS agent_upgrade_requests_status_requested_at_idx
  ON public.agent_upgrade_requests (status, requested_at DESC);

ALTER TABLE public.agent_upgrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_upgrade_select_own_or_admin" ON public.agent_upgrade_requests;
CREATE POLICY "agent_upgrade_select_own_or_admin"
  ON public.agent_upgrade_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agent_upgrade_insert_own_pending" ON public.agent_upgrade_requests;
CREATE POLICY "agent_upgrade_insert_own_pending"
  ON public.agent_upgrade_requests
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND requested_user_role = 'agent'
    AND current_user_role = 'user'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.role, 'user') = 'user'
    )
  );

DROP POLICY IF EXISTS "agent_upgrade_admin_update" ON public.agent_upgrade_requests;
CREATE POLICY "agent_upgrade_admin_update"
  ON public.agent_upgrade_requests
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Realtime for NotificationCenter + toast hooks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_upgrade_requests;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
