import { useEffect } from "react";
import useAgentDashboardStore from "@/stores/useAgentDashboardStore";

/** Authoritative listings refetch when the agent returns to the dashboard tab/window. */
export function useAgentDashboardFocusSync(userId, role) {
  useEffect(() => {
    if (!userId || role !== "agent") return undefined;

    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      useAgentDashboardStore.getState().invalidate({ listings: true });
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, role]);
}
