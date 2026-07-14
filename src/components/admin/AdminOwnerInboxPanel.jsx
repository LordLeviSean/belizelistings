import { useCallback, useEffect, useMemo, useState } from "react";
import AgentViewingsPanel from "@/components/inquiry/AgentViewingsPanel";
import OwnerInquiriesPanel from "@/components/inquiry/OwnerInquiriesPanel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { loadOwnerInboxData } from "@/lib/crm/ownerInboxData";
import { supabase } from "@/lib/supabaseClient";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

/**
 * Inbox + viewings for listings where the admin is listing.user_id (owner).
 * conversations.agent_id matches listing.user_id per CRM foundation.
 */
export default function AdminOwnerInboxPanel({
  ownerUserId,
  section = "inquiries",
  onRefresh: onRefreshProp,
  surface = "admin",
  initialConversationId = null,
  initialViewingId = null,
}) {
  const [conversations, setConversations] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [listingsById, setListingsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (!ownerUserId) return;
    setLoading(true);
    setLoadError(null);
    const { conversations: convRows, viewings: viewingRows, listingsById: map, errors } =
      await loadOwnerInboxData(supabase, ownerUserId);
    if (errors?.conversations) {
      setLoadError(errors.conversations.message || "Could not load inbox.");
    }
    setConversations(convRows);
    setViewings(viewingRows);
    setListingsById(map);
    setLoading(false);
  }, [ownerUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    onRefreshProp?.();
  }, [load, onRefreshProp]);

  const hasOwnedListings = useMemo(() => Object.keys(listingsById).length > 0, [listingsById]);
  const hasOwnerActivity = conversations.length > 0 || viewings.length > 0;

  if (!BL_ENABLE_CONVERSATIONS && !BL_ENABLE_VIEWING_PERSIST) {
    return (
      <p className={styles.muted}>
        Enable CRM conversation or viewing flags to access Inbox for your listings.
      </p>
    );
  }

  if (loading) {
    return <div className={loadingStyles.hydratingPanel} aria-busy="true" />;
  }

  if (loadError) {
    return (
      <PremiumEmptyState
        variant="generic"
        compact
        title="Could not load inbox"
        description={loadError}
        primary={{ label: "Try again", onClick: () => void refresh() }}
      />
    );
  }

  if (!hasOwnedListings && !hasOwnerActivity) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        title={surface === "user" ? "No listing inquiries yet" : "No listings on your account"}
        description={
          surface === "user"
            ? "Create a listing to receive inquiries and viewings here."
            : "Create a listing to receive inquiries here, or use operator tools for listings owned by other users."
        }
      />
    );
  }

  if (section === "viewings" && BL_ENABLE_VIEWING_PERSIST) {
    return (
      <div>
        <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
          Viewings for listings you own. Confirm or reschedule from the same panel agents use.
        </p>
        <AgentViewingsPanel
          viewings={viewings}
          listingsById={listingsById}
          agentUserId={ownerUserId}
          onRefresh={refresh}
          initialViewingId={initialViewingId}
          surface={surface}
        />
      </div>
    );
  }

  if (!BL_ENABLE_CONVERSATIONS) {
    return (
      <p className={styles.muted}>
        Enable conversation flags to receive buyer messages for your listings.
      </p>
    );
  }

  return (
    <div>
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Inbox for listings you own (where you are the listing agent). Buyer threads stay grouped by listing.
      </p>
      <OwnerInquiriesPanel
        conversations={conversations}
        listingsById={listingsById}
        agentUserId={ownerUserId}
        onRefresh={refresh}
        initialConversationId={initialConversationId}
      />
    </div>
  );
}
