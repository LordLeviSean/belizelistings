import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";

/**
 * Refresh viewing lists when viewing_requests change for the signed-in participant.
 */
export function useViewingsRealtime({ userId, asAgent }, onRefresh) {
  useEffect(() => {
    if (!BL_ENABLE_VIEWING_PERSIST || !userId || !supabase?.channel || !onRefresh) return undefined;

    const filterColumn = asAgent ? "agent_user_id" : "requester_id";
    const channel = supabase
      .channel(`crm-viewings-${asAgent ? "agent" : "buyer"}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "viewing_requests",
          filter: `${filterColumn}=eq.${userId}`,
        },
        () => {
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, asAgent, onRefresh]);
}
