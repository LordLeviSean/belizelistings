import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentViewingsPanel from "@/components/inquiry/AgentViewingsPanel";
import OwnerInquiriesPanel from "@/components/inquiry/OwnerInquiriesPanel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_VIEWING_PERSIST } from "@/lib/featureFlags";
import { loadOwnerInboxData } from "@/lib/crm/ownerInboxData";
import {
  applyOwnerInboxLoadResult,
  beginCrmRequest,
  invalidateCrmRequests,
  isStaleCrmRequest,
} from "@/lib/crm/crmListLoaderUtils";
import { conversationListIncludesId } from "@/lib/crm/conversationDeepLink";
import { resolveParticipantConversationDeepLink } from "@/lib/crm/participantConversationDeepLink";
import { resolveAgentViewingDeepLink } from "@/lib/crm/viewingParticipantDeepLink";
import { viewingListIncludesId } from "@/lib/crm/viewingDeepLink";
import { supabase } from "@/lib/supabaseClient";
import { useParticipantEntityDeepLinkResolve } from "@/hooks/useParticipantEntityDeepLinkResolve";
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
  const [conversationError, setConversationError] = useState(null);
  const [viewingError, setViewingError] = useState(null);
  const ownerLoadGenerationRef = useRef(0);
  const conversationsRef = useRef([]);
  const viewingsRef = useRef([]);
  const listingsByIdRef = useRef({});
  const initialConversationIdRef = useRef(initialConversationId);
  const initialViewingIdRef = useRef(initialViewingId);

  conversationsRef.current = conversations;
  viewingsRef.current = viewings;
  listingsByIdRef.current = listingsById;
  initialConversationIdRef.current = initialConversationId;
  initialViewingIdRef.current = initialViewingId;

  const load = useCallback(async () => {
    if (!ownerUserId) return;
    const generation = beginCrmRequest(ownerLoadGenerationRef);
    const hasExistingData = conversationsRef.current.length > 0 || viewingsRef.current.length > 0;
    if (!hasExistingData) {
      setLoading(true);
    }

    const result = await loadOwnerInboxData(supabase, ownerUserId);
    if (isStaleCrmRequest(ownerLoadGenerationRef, generation)) {
      return;
    }

    const applied = applyOwnerInboxLoadResult({
      generationRef: ownerLoadGenerationRef,
      generation,
      result,
      previous: {
        conversations: conversationsRef.current,
        viewings: viewingsRef.current,
        listingsById: listingsByIdRef.current,
      },
      deepLinkConversationId: initialConversationIdRef.current,
      deepLinkViewingId: initialViewingIdRef.current,
    });

    if (!applied) {
      return;
    }

    setConversations(applied.conversations);
    setViewings(applied.viewings);
    setListingsById(applied.listingsById);
    setConversationError(applied.conversationError);
    setViewingError(applied.viewingError);
    setLoading(false);
  }, [ownerUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      invalidateCrmRequests(ownerLoadGenerationRef);
    };
  }, []);

  const fetchOwnerConversationById = useCallback(
    async ({ participantUserId, entityId, list, listingsById: listingsMap }) =>
      resolveParticipantConversationDeepLink(
        supabase,
        participantUserId,
        entityId,
        list,
        listingsMap,
        { role: "agent" }
      ),
    []
  );

  const handleOwnerConversationDeepLinkFetched = useCallback((result) => {
    setConversations(result.conversations);
    setListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const fetchOwnerViewingById = useCallback(
    async ({ participantUserId, entityId, list, listingsById: listingsMap }) =>
      resolveAgentViewingDeepLink(supabase, participantUserId, entityId, list, listingsMap),
    []
  );

  const handleOwnerViewingDeepLinkFetched = useCallback((result) => {
    setViewings(result.viewings);
    setListingsById((prev) => ({ ...prev, ...result.listingsById }));
  }, []);

  const conversationDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(ownerUserId && initialConversationId && section === "inquiries"),
    participantUserId: ownerUserId,
    entityId: initialConversationId,
    listLoading: loading && !conversations.length,
    listIncludesTarget: conversationListIncludesId,
    getListSnapshot: () => conversations,
    getListingsByIdSnapshot: () => listingsById,
    fetchById: fetchOwnerConversationById,
    onFetched: handleOwnerConversationDeepLinkFetched,
  });

  const viewingDeepLinkResolveState = useParticipantEntityDeepLinkResolve({
    enabled: Boolean(ownerUserId && initialViewingId && section === "viewings"),
    participantUserId: ownerUserId,
    entityId: initialViewingId,
    listLoading: loading && !viewings.length,
    listIncludesTarget: viewingListIncludesId,
    getListSnapshot: () => viewings,
    getListingsByIdSnapshot: () => listingsById,
    fetchById: fetchOwnerViewingById,
    onFetched: handleOwnerViewingDeepLinkFetched,
  });

  const refresh = useCallback(async () => {
    await load();
    onRefreshProp?.();
  }, [load, onRefreshProp]);

  const hasOwnedListings = useMemo(() => Object.keys(listingsById).length > 0, [listingsById]);
  const hasOwnerActivity = conversations.length > 0 || viewings.length > 0;
  const sectionError =
    section === "inquiries"
      ? conversationError
      : section === "viewings"
        ? viewingError
        : conversationError || viewingError;
  const hasDeepLinkTarget =
    (section === "inquiries" && initialConversationId) ||
    (section === "viewings" && initialViewingId);
  const deepLinkResolved =
    section === "inquiries"
      ? conversationDeepLinkResolveState === "resolved"
      : section === "viewings"
        ? viewingDeepLinkResolveState === "resolved"
        : false;

  if (!BL_ENABLE_CONVERSATIONS && !BL_ENABLE_VIEWING_PERSIST) {
    return (
      <p className={styles.muted}>
        Enable CRM conversation or viewing flags to access Inbox for your listings.
      </p>
    );
  }

  if (loading && !initialConversationId && !initialViewingId) {
    return <div className={loadingStyles.hydratingPanel} aria-busy="true" />;
  }

  if (
    loading &&
    ((section === "inquiries" && initialConversationId) ||
      (section === "viewings" && initialViewingId))
  ) {
    return <div className={loadingStyles.hydratingPanel} aria-busy="true" aria-label="Loading" />;
  }

  if (
    sectionError &&
    !hasOwnerActivity &&
    !hasDeepLinkTarget &&
    !deepLinkResolved
  ) {
    return (
      <PremiumEmptyState
        variant="generic"
        compact
        title="Could not load inbox"
        description={sectionError}
        primary={{ label: "Try again", onClick: () => void refresh() }}
      />
    );
  }

  if (!hasOwnedListings && !hasOwnerActivity && !initialConversationId && !initialViewingId) {
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
        {viewingError && viewings.length > 0 ? (
          <p className={styles.muted} role="status" style={{ marginBottom: 12 }}>
            Unable to refresh viewing requests right now.
          </p>
        ) : null}
        {viewingError && !viewings.length && !initialViewingId ? (
          <p className={styles.muted} role="alert" style={{ marginBottom: 12 }}>
            Unable to load viewing requests right now.
          </p>
        ) : null}
        <AgentViewingsPanel
          viewings={viewings}
          listingsById={listingsById}
          agentUserId={ownerUserId}
          onRefresh={refresh}
          initialViewingId={initialViewingId}
          deepLinkResolveState={viewingDeepLinkResolveState}
          crmLoading={loading && !viewings.length}
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
      {conversationError && conversations.length > 0 ? (
        <p className={styles.muted} role="status" style={{ marginBottom: 12 }}>
          Unable to refresh conversations right now.
        </p>
      ) : null}
      {conversationError && !conversations.length && !initialConversationId ? (
        <p className={styles.muted} role="alert" style={{ marginBottom: 12 }}>
          Unable to load conversations right now.
        </p>
      ) : null}
      <OwnerInquiriesPanel
        conversations={conversations}
        listingsById={listingsById}
        agentUserId={ownerUserId}
        onRefresh={refresh}
        initialConversationId={initialConversationId}
        deepLinkResolveState={conversationDeepLinkResolveState}
        crmLoading={loading && !conversations.length}
      />
    </div>
  );
}
