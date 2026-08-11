import { useCallback, useEffect, useMemo, useState } from "react";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import {
  countOwnerInboxUnread,
  groupConversationsByListing,
} from "@/lib/crm/conversationGrouping";
import {
  deleteConversationForAgent,
  fetchConversationMessages,
  isAgentConversationUnread,
  markConversationReadByAgent,
  sendAgentReply,
} from "@/lib/crm/conversationMutations";
import { useConversationMessagesRealtime } from "@/lib/crm/useConversationMessagesRealtime";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import ConversationThread from "./ConversationThread";
import ListingInboxSidebar from "./ListingInboxSidebar";
import styles from "./OwnerInquiriesPanel.module.css";

export default function OwnerInquiriesPanel({
  conversations = [],
  listingsById = {},
  agentUserId,
  onRefresh,
  legacyFallback = null,
  initialConversationId = null,
}) {
  const { showToast } = useToast();
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversationId);
  const [mobilePane, setMobilePane] = useState("listings");
  const [isCompact, setIsCompact] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const groups = useMemo(
    () => groupConversationsByListing(conversations, listingsById),
    [conversations, listingsById]
  );

  const unreadCount = useMemo(() => countOwnerInboxUnread(conversations), [conversations]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.listingId === selectedListingId) || null,
    [groups, selectedListingId]
  );

  const selectedConversation = useMemo(() => {
    if (selectedConversationId) {
      return conversations.find((c) => c.id === selectedConversationId) || null;
    }
    return selectedGroup?.conversations?.[0] || null;
  }, [conversations, selectedConversationId, selectedGroup]);

  useEffect(() => {
    if (!initialConversationId) return;
    setSelectedConversationId(initialConversationId);
    const match = conversations.find((c) => c.id === initialConversationId);
    if (match?.listing_id) {
      setSelectedListingId(match.listing_id);
      const compact =
        typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
      if (compact) setMobilePane("thread");
    }
  }, [initialConversationId, conversations]);

  const listingTitle =
    listingsById?.[selectedConversation?.listing_id]?.title ||
    selectedGroup?.title ||
    (selectedConversation?.listing_id ? `Listing #${selectedConversation.listing_id}` : "Property");

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    const { data, error } = await fetchConversationMessages(supabase, conversationId);
    setMessagesLoading(false);
    if (error) {
      setMessages([]);
      return;
    }
    setMessages(data || []);
  }, []);

  useEffect(() => {
    if (selectedConversation?.id) void loadMessages(selectedConversation.id);
  }, [selectedConversation?.id, loadMessages]);

  const handleRealtimeMessage = useCallback(
    (row) => {
      if (!row?.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
    },
    []
  );

  useConversationMessagesRealtime(selectedConversation?.id, handleRealtimeMessage, onRefresh);

  useEffect(() => {
    if (!selectedConversation?.id || !agentUserId) return;
    const conv = conversations.find((c) => c.id === selectedConversation.id);
    if (!conv || !isAgentConversationUnread(conv)) return;
    void markConversationReadByAgent(supabase, {
      conversationId: selectedConversation.id,
      agentUserId,
    }).then(() => onRefresh?.());
  }, [selectedConversation?.id, agentUserId, conversations, onRefresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!groups.length && !initialConversationId) {
      setSelectedListingId(null);
      setSelectedConversationId(null);
    }
  }, [groups, initialConversationId]);

  const handleSelectListing = (group) => {
    setSelectedListingId(group.listingId);
    setSelectedConversationId(group.conversations[0]?.id ?? null);
    if (isCompact) setMobilePane("conversations");
  };

  const handleSelectConversation = (conv) => {
    setSelectedConversationId(conv.id);
    if (isCompact) setMobilePane("thread");
  };

  const handleSendReply = async () => {
    if (!selectedConversation?.id || !agentUserId || replyBusy) return;
    const body = replyBody.trim();
    if (!body) return;
    setReplyBusy(true);
    const { error } = await sendAgentReply(supabase, {
      conversationId: selectedConversation.id,
      agentUserId,
      body,
      listingId: selectedConversation.listing_id,
    });
    setReplyBusy(false);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not send reply." });
      return;
    }
    setReplyBody("");
    showToast({ type: "success", message: "Reply sent." });
    await loadMessages(selectedConversation.id);
    onRefresh?.();
  };

  const handleDeleteConversation = async () => {
    if (!deleteTarget?.id || !agentUserId) return;
    setDeleteBusy(true);
    const { error } = await deleteConversationForAgent(supabase, {
      conversationId: deleteTarget.id,
      agentUserId,
    });
    setDeleteBusy(false);
    setDeleteTarget(null);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not delete conversation." });
      return;
    }
    showToast({ type: "success", message: "Conversation permanently removed from your inbox." });
    setSelectedConversationId(null);
    if (isCompact) setMobilePane("conversations");
    onRefresh?.();
  };

  if (!BL_ENABLE_CONVERSATIONS) {
    return legacyFallback ?? null;
  }

  if (!conversations?.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Open listing editor", href: "/dashboard/create" }}
        secondary={{ label: "View live site", href: "/" }}
      />
    );
  }

  const showConversationList =
    selectedListingId != null && (!isCompact || mobilePane !== "listings");
  const showSidebar = !isCompact || mobilePane !== "thread";
  const showThread = !isCompact || mobilePane === "thread";

  return (
    <div className={styles.shell}>
      {unreadCount > 0 ? (
        <p className={styles.unreadBanner} aria-live="polite">
          {unreadCount} unread conversation{unreadCount === 1 ? "" : "s"}
        </p>
      ) : null}

      <div
        className={`${styles.layout} ${!showSidebar ? styles.layoutHideSidebar : ""} ${
          !showThread ? styles.layoutHideThread : ""
        }`}
      >
        {showSidebar ? (
          <aside className={styles.sidebar} aria-label="Listing inquiry groups">
            <ListingInboxSidebar
              groups={groups}
              selectedListingId={selectedListingId}
              selectedConversationId={selectedConversation?.id}
              showConversationList={showConversationList}
              onSelectListing={handleSelectListing}
              onSelectConversation={handleSelectConversation}
              onBackToListings={() => {
                setMobilePane("listings");
                setSelectedListingId(null);
                setSelectedConversationId(null);
              }}
              showListingBack={isCompact && mobilePane === "conversations"}
            />
          </aside>
        ) : null}

        {showThread ? (
          <section className={styles.threadPane} aria-label="Conversation thread">
            <ConversationThread
              conversation={selectedConversation}
              listingTitle={listingTitle}
              messages={messages}
              messagesLoading={messagesLoading}
              replyBody={replyBody}
              onReplyChange={(e) => setReplyBody(e.target.value)}
              onSendReply={() => void handleSendReply()}
              replyBusy={replyBusy}
              showBack={isCompact && mobilePane === "thread"}
              onBack={() => setMobilePane("conversations")}
              backLabel="Conversations"
              onDelete={
                selectedConversation?.id
                  ? () => setDeleteTarget(selectedConversation)
                  : null
              }
            />
          </section>
        ) : null}
      </div>

      <DeleteConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConversation()}
        title="Delete conversation permanently?"
        warningText="This can't be undone. The thread will be removed from your account only — the buyer's copy is unaffected."
        confirmLabel="Delete permanently"
        loading={deleteBusy}
        requireTypeDelete={false}
      />
    </div>
  );
}
