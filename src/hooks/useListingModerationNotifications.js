import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { LISTING_MODERATION_TOAST } from "@/constants/listingModerationNotifications";
import { emitUserDashboardMetricsInvalidation } from "@/lib/userDashboardMetricsBus";
import useUserDashboardStore from "@/stores/useUserDashboardStore";
import useAgentDashboardStore from "@/stores/useAgentDashboardStore";

/**
 * Realtime toasts when a user's listing is approved or rejected by moderation.
 */
export default function useListingModerationNotifications() {
  const { user } = useUserRole();
  const { showToast } = useToast();
  const lifecycleByIdRef = useRef(new Map());

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;

    const seed = async () => {
      const { data } = await supabase
        .from("listings")
        .select("id,lifecycle_status,status,moderation_status")
        .eq("user_id", user.id)
        .limit(120);
      if (cancelled) return;
      for (const row of data || []) {
        lifecycleByIdRef.current.set(String(row.id), getLifecycleStatus(row));
      }
    };

    void seed();

    const channel = supabase
      .channel(`listing-moderation-notify-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const id = String(payload.new?.id || "");
          if (!id) return;
          const prev = lifecycleByIdRef.current.get(id) ?? getLifecycleStatus(payload.old);
          const next = getLifecycleStatus(payload.new);
          lifecycleByIdRef.current.set(id, next);
          if (prev === next) return;

          if (next === LISTING_LIFECYCLE.PUBLISHED && prev !== LISTING_LIFECYCLE.PUBLISHED) {
            useUserDashboardStore.getState().reconcileListingFromServer(payload.new);
            useAgentDashboardStore.getState().reconcileListingFromServer(payload.new);
            showToast({ type: "success", message: LISTING_MODERATION_TOAST.APPROVED });
            emitUserDashboardMetricsInvalidation(user.id);
            return;
          }
          if (next === LISTING_LIFECYCLE.REJECTED && prev !== LISTING_LIFECYCLE.REJECTED) {
            useUserDashboardStore.getState().reconcileListingFromServer(payload.new);
            useAgentDashboardStore.getState().reconcileListingFromServer(payload.new);
            showToast({ type: "info", message: LISTING_MODERATION_TOAST.REJECTED });
            emitUserDashboardMetricsInvalidation(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, showToast]);
}
