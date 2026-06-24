import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AGENT_UPGRADE_REQUEST_STATUS,
  AGENT_UPGRADE_TOAST,
} from "@/constants/agentUpgradeNotifications";
import { emitAgentUpgradeApproved } from "@/lib/agentUpgradeWelcome";

/**
 * Realtime toasts when an agent upgrade request is approved or rejected.
 * Refetches profile on approval so listing cap updates without logout.
 */
export default function useAgentUpgradeNotifications() {
  const { user, refetchProfile } = useUserRole();
  const { showToast } = useToast();
  const statusByIdRef = useRef(new Map());

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;

    const seed = async () => {
      const { data } = await supabase
        .from("agent_upgrade_requests")
        .select("id,status")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      for (const row of data || []) {
        statusByIdRef.current.set(String(row.id), String(row.status || ""));
      }
    };

    void seed();

    const channel = supabase
      .channel(`agent-upgrade-notify-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_upgrade_requests",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const id = String(payload.new?.id || payload.old?.id || "");
          if (!id) return;
          const prev = statusByIdRef.current.get(id) ?? String(payload.old?.status || "");
          const next = String(payload.new?.status || prev);
          statusByIdRef.current.set(id, next);
          if (prev === next) return;

          if (next === AGENT_UPGRADE_REQUEST_STATUS.APPROVED && prev !== AGENT_UPGRADE_REQUEST_STATUS.APPROVED) {
            showToast({ type: "success", message: AGENT_UPGRADE_TOAST.APPROVED });
            emitAgentUpgradeApproved(user.id);
            void refetchProfile?.();
            return;
          }
          if (next === AGENT_UPGRADE_REQUEST_STATUS.REJECTED && prev !== AGENT_UPGRADE_REQUEST_STATUS.REJECTED) {
            showToast({ type: "info", message: AGENT_UPGRADE_TOAST.REJECTED });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, showToast, refetchProfile]);
}
