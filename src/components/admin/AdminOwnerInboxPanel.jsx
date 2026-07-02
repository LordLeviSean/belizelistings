import { useCallback, useEffect, useMemo, useState } from "react";
import AgentViewingsPanel from "@/components/inquiry/AgentViewingsPanel";
import OwnerInquiriesPanel from "@/components/inquiry/OwnerInquiriesPanel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { fetchConversationsForAgent } from "@/lib/crm/conversationMutations";
import { fetchViewingsForAgent } from "@/lib/crm/viewingMutations";
import { supabase } from "@/lib/supabaseClient";
import styles from "@/styles/Dashboard.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

/**
 * Inbox + viewings for listings where the admin is listing.user_id (owner).
 * conversations.agent_id matches listing.user_id per CRM foundation.
 */
export default function AdminOwnerInboxPanel({ ownerUserId }) {
  const [conversations, setConversations] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [listingsById, setListingsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("inquiries");

  const load = useCallback(async () => {
    if (!ownerUserId) return;
    setLoading(true);
    const tasks = [];

    if (BL_ENABLE_CONVERSATIONS) {
      tasks.push(
        fetchConversationsForAgent(supabase, ownerUserId).then(({ data }) => {
          setConversations(data || []);
        })
      );
    }

    if (BL_ENABLE_VIEWING_PERSIST) {
      tasks.push(
        fetchViewingsForAgent(supabase, ownerUserId).then(({ data }) => {
          setViewings(data || []);
        })
      );
    }

    tasks.push(
      supabase
        .from("listings")
        .select("id,title")
        .eq("user_id", ownerUserId)
        .then(({ data }) => {
          const map = {};
          for (const row of data || []) {
            if (row?.id != null) map[row.id] = row;
          }
          setListingsById(map);
        })
    );

    await Promise.all(tasks);
    setLoading(false);
  }, [ownerUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOwnedListings = useMemo(() => Object.keys(listingsById).length > 0, [listingsById]);

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

  if (!hasOwnedListings) {
    return (
      <p className={styles.muted}>
        You have no listings assigned to your account. Create a listing to receive inquiries here, or use the
        operator tools for listings owned by other users.
      </p>
    );
  }

  return (
    <div>
      <p className={styles.muted} style={{ marginBottom: 16, maxWidth: "62ch" }}>
        Messages and viewings for listings you own (where you are the listing agent). This uses the same inbox as
        the agent dashboard.
      </p>
      <div className={styles.statusToggle} role="tablist" aria-label="Owner inbox sections" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={section === "inquiries"}
          className={`${styles.toggleButton} ${section === "inquiries" ? styles.toggleButtonActive : ""}`}
          onClick={() => setSection("inquiries")}
        >
          Inquiries
        </button>
        {BL_ENABLE_VIEWING_PERSIST ? (
          <button
            type="button"
            role="tab"
            aria-selected={section === "viewings"}
            className={`${styles.toggleButton} ${section === "viewings" ? styles.toggleButtonActive : ""}`}
            onClick={() => setSection("viewings")}
          >
            Viewings
          </button>
        ) : null}
      </div>
      {section === "inquiries" && BL_ENABLE_CONVERSATIONS ? (
        <OwnerInquiriesPanel
          conversations={conversations}
          listingsById={listingsById}
          agentUserId={ownerUserId}
          onRefresh={load}
        />
      ) : null}
      {section === "viewings" && BL_ENABLE_VIEWING_PERSIST ? (
        <AgentViewingsPanel
          viewings={viewings}
          listingsById={listingsById}
          agentUserId={ownerUserId}
          onRefresh={load}
        />
      ) : null}
    </div>
  );
}
