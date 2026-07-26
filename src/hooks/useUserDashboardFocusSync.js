import { useEffect } from "react";
import useUserDashboardStore from "@/stores/useUserDashboardStore";

/** Authoritative listings refetch when the owner returns to the dashboard tab/window. */
export function useUserDashboardFocusSync(userId, role) {
  useEffect(() => {
    if (!userId || role !== "user") return undefined;

    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      useUserDashboardStore.getState().invalidate({ listings: true });
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, role]);
}
