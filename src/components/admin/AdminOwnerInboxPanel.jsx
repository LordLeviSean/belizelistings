import { useCallback, useEffect, useMemo, useState } from "react";
import AgentViewingsPanel from "@/components/inquiry/AgentViewingsPanel";
import OwnerInquiriesPanel from "@/components/inquiry/OwnerInquiriesPanel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { loadOwnerInboxData } from "@/lib/crm/ownerInboxData";
import { supabase } from "@/lib/supabaseClient";
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
}) {
  const [conversations, setConversations] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [listingsById, setListingsById] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ownerUserId) return;
    setLoading(true);
    const { conversations: convRows, viewings: viewingRows, listingsById: map } = await loadOwnerInboxData(
      supabase,
      ownerUserId
    );
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
        Enable CRM conversation or viewing flags to access owner inbox for your listings.
      </p>
    );
  }

  if (loading) {
    return <div className={loadingStyles.hydratingPanel} aria-busy="true" />;
  }

  if (!hasOwnedListings && !hasOwnerActivity) {
    return (
      <p className={styles.muted}>
        {surface === "user"
          ? "You have no listings yet. Create a listing to receive inquiries and viewing requests here."
          : "You have no listings assigned to your account. Create a listing to receive inquiries here, or use the operator tools for listings owned by other users."}
      </p>
    );
  }

  if (section === "viewings" && BL_ENABLE_VIEWING_PERSIST) {
    return (
      <div>
        <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
          Viewing requests for listings you own. Confirm or reschedule from the same panel agents use.
        </p>
        <AgentViewingsPanel
          viewings={viewings}
          listingsById={listingsById}
          agentUserId={ownerUserId}
          onRefresh={refresh}
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
        Messages for listings you own (where you are the listing agent). Buyer threads stay grouped by listing.
      </p>
      <OwnerInquiriesPanel
        conversations={conversations}
        listingsById={listingsById}
        agentUserId={ownerUserId}
        onRefresh={refresh}
      />
    </div>
  );
}
