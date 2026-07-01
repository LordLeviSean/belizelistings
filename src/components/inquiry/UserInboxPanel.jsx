import { useCallback, useEffect, useMemo, useState } from "react";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import { inquiryTypeLabel } from "@/lib/crm/crmConstants";
import {
  conversationPreviewText,
  fetchConversationMessages,
  isBuyerConversationUnread,
  markConversationReadByBuyer,
  sendBuyerReply,
} from "@/lib/crm/conversationMutations";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import listStyles from "./AgentInquiryList.module.css";
import inboxStyles from "./AgentInboxPanel.module.css";
import styles from "./UserInboxPanel.module.css";

export default function UserInboxPanel({
  conversations = [],
  listingsById = {},
  buyerUserId,
  onRefresh,
  initialConversationId = null,
}) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const sorted = useMemo(
    () =>
      [...(conversations || [])].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      ),
    [conversations]
  );

  useEffect(() => {
    if (initialConversationId) setSelectedId(initialConversationId);
  }, [initialConversationId]);

  const selected = sorted.find((c) => c.id === selectedId) || sorted[0] || null;

  const unreadCount = useMemo(
    () => sorted.filter((conv) => isBuyerConversationUnread(conv)).length,
    [sorted]
  );

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
    if (selected?.id) void loadMessages(selected.id);
  }, [selected?.id, loadMessages]);

  useEffect(() => {
    if (!selected?.id || !buyerUserId) return;
    const conv = sorted.find((c) => c.id === selected.id);
    if (!conv || !isBuyerConversationUnread(conv)) return;
    void markConversationReadByBuyer(supabase, {
      conversationId: selected.id,
      buyerUserId,
    }).then(() => onRefresh?.());
  }, [selected?.id, buyerUserId, sorted, onRefresh]);

  const handleSendReply = async () => {
    if (!selected?.id || !buyerUserId || replyBusy) return;
    const body = replyBody.trim();
    if (!body) return;
    setReplyBusy(true);
    const { error } = await sendBuyerReply(supabase, {
      conversationId: selected.id,
      buyerUserId,
      body,
      listingId: selected.listing_id,
    });
    setReplyBusy(false);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not send message." });
      return;
    }
    setReplyBody("");
    showToast({ type: "success", message: "Your message has been delivered to the listing agent." });
    await loadMessages(selected.id);
    onRefresh?.();
  };

  if (!BL_ENABLE_CONVERSATIONS) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Browse listings", href: "/" }}
      />
    );
  }

  if (!sorted.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Browse listings", href: "/" }}
        secondary={{ label: "View live site", href: "/" }}
      />
    );
  }

  const listingTitle =
    listingsById?.[selected?.listing_id]?.title ||
    (selected?.listing_id ? `Listing #${selected.listing_id}` : "Property");

  return (
    <div className={inboxStyles.shell}>
      <p className={styles.lede}>
        Messages you send from listing pages appear here. Replies from agents land in the same thread.
      </p>

      {unreadCount > 0 ? (
        <p className={styles.unreadBanner} aria-live="polite">
          {unreadCount} unread repl{unreadCount === 1 ? "y" : "ies"}
        </p>
      ) : null}

      <div className={inboxStyles.split}>
        <div className={listStyles.list} role="list" aria-label="Your conversations">
          {sorted.map((conv) => {
            const isSelected = selected?.id === conv.id;
            const unread = isBuyerConversationUnread(conv);
            const inquiry = conv?.listing_inquiries;
            const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;
            return (
              <button
                key={conv.id}
                type="button"
                role="listitem"
                aria-selected={isSelected}
                className={`${listStyles.card} ${inboxStyles.convBtn} ${unread ? listStyles.cardUnread : ""} ${
                  isSelected ? inboxStyles.convBtnSelected : ""
                }`}
                onClick={() => setSelectedId(conv.id)}
              >
                <header className={listStyles.cardHead}>
                  <span className={listStyles.channel}>
                    {inquiryTypeLabel(row?.inquiry_type || conv.inquiry_type || "general")}
                    {unread ? (
                      <span className={inboxStyles.unreadDot} aria-label="Unread">
                        {" "}
                        · New
                      </span>
                    ) : null}
                  </span>
                  <time className={listStyles.time} dateTime={conv.updated_at}>
                    {formatRelativeTime(conv.updated_at || conv.created_at)}
                  </time>
                </header>
                <p className={listStyles.listingRef}>
                  {listingsById?.[conv.listing_id]?.title || `Listing ${conv.listing_id}`}
                </p>
                <p className={listStyles.body}>{conversationPreviewText(conv)}</p>
              </button>
            );
          })}
        </div>

        <aside className={inboxStyles.detail} aria-label="Conversation thread">
          {selected ? (
            <>
              <header className={inboxStyles.detailHead}>
                <h3 className={inboxStyles.detailTitle}>{listingTitle}</h3>
                <p className={inboxStyles.detailMeta}>
                  {selected.pipeline_stage ? selected.pipeline_stage.replace(/_/g, " ") : "Open"}
                </p>
              </header>

              <div className={inboxStyles.thread} aria-live="polite" aria-busy={messagesLoading}>
                {messagesLoading ? (
                  <p className={inboxStyles.threadMuted}>Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className={inboxStyles.threadMuted}>No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${inboxStyles.bubble} ${
                        msg.sender_role === "buyer" ? inboxStyles.bubbleBuyer : inboxStyles.bubbleAgent
                      }`}
                    >
                      <p className={inboxStyles.bubbleBody}>{msg.body}</p>
                      <time className={inboxStyles.bubbleTime} dateTime={msg.created_at}>
                        {formatRelativeTime(msg.created_at)}
                      </time>
                    </div>
                  ))
                )}
              </div>

              <div className={inboxStyles.composer}>
                <label className={inboxStyles.composerLabel} htmlFor="buyer-inbox-reply">
                  Your message
                </label>
                <textarea
                  id="buyer-inbox-reply"
                  className={inboxStyles.composerInput}
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Follow up with the agent…"
                />
                <button
                  type="button"
                  className={listStyles.primary}
                  disabled={replyBusy || !replyBody.trim()}
                  onClick={() => void handleSendReply()}
                >
                  {replyBusy ? "Sending…" : "Send message"}
                </button>
              </div>
            </>
          ) : (
            <p className={inboxStyles.threadMuted}>Select a conversation.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
