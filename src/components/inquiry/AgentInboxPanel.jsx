import { useCallback, useEffect, useMemo, useState } from "react";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import {
  AGENT_INBOX_GROUPS,
  CRM_PIPELINE_STAGE,
  inquiryTypeLabel,
  resolveInboxGroupId,
} from "@/lib/crm/crmConstants";
import { fetchConversationMessages, sendAgentReply } from "@/lib/crm/conversationMutations";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import listStyles from "./AgentInquiryList.module.css";
import styles from "./AgentInboxPanel.module.css";

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

function conversationPreview(conv) {
  const inquiry = conv?.listing_inquiries;
  const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;
  return row?.message || row?.body || conv?.buyer_email || "New inquiry";
}

export default function AgentInboxPanel({
  conversations = [],
  listingsById = {},
  agentUserId,
  onRefresh,
  legacyFallback = null,
}) {
  const { showToast } = useToast();
  const [activeGroup, setActiveGroup] = useState("new");
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(AGENT_INBOX_GROUPS.map((g) => [g.id, []]));
    for (const conv of conversations) {
      const inquiry = conv?.listing_inquiries;
      const row = Array.isArray(inquiry) ? inquiry[0] : inquiry;
      const enriched = {
        ...conv,
        inquiry_status: row?.status,
        inquiry_type: row?.inquiry_type,
      };
      const gid = resolveInboxGroupId(enriched);
      if (map[gid]) map[gid].push(enriched);
      else map.new.push(enriched);
    }
    return map;
  }, [conversations]);

  const visibleList = grouped[activeGroup] || [];
  const selected = visibleList.find((c) => c.id === selectedId) || visibleList[0] || null;

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
    if (selected?.id) loadMessages(selected.id);
  }, [selected?.id, loadMessages]);

  const handleSendReply = async () => {
    if (!selected?.id || !agentUserId || replyBusy) return;
    const body = replyBody.trim();
    if (!body) return;
    setReplyBusy(true);
    const { error } = await sendAgentReply(supabase, {
      conversationId: selected.id,
      agentUserId,
      body,
      listingId: selected.listing_id,
    });
    setReplyBusy(false);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not send reply." });
      return;
    }
    setReplyBody("");
    showToast({ type: "success", message: "Reply sent." });
    await loadMessages(selected.id);
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

  const listingTitle =
    listingsById?.[selected?.listing_id]?.title ||
    (selected?.listing_id ? `Listing #${selected.listing_id}` : "Property");

  return (
    <div className={styles.shell}>
      <nav className={styles.groupNav} aria-label="Inbox groups">
        {AGENT_INBOX_GROUPS.map((group) => {
          const count = grouped[group.id]?.length || 0;
          return (
            <button
              key={group.id}
              type="button"
              className={`${styles.groupBtn} ${activeGroup === group.id ? styles.groupBtnActive : ""}`}
              aria-pressed={activeGroup === group.id}
              onClick={() => {
                setActiveGroup(group.id);
                setSelectedId(null);
              }}
            >
              {group.label}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </nav>

      <div className={styles.split}>
        <div className={listStyles.list} role="list" aria-label={`${activeGroup} conversations`}>
          {visibleList.length === 0 ? (
            <p className={listStyles.empty}>No conversations in this group.</p>
          ) : (
            visibleList.map((conv) => {
              const unread = conv.pipeline_stage === CRM_PIPELINE_STAGE.NEW_INQUIRY;
              const isSelected = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  role="listitem"
                  className={`${listStyles.card} ${styles.convBtn} ${unread ? listStyles.cardUnread : ""} ${
                    isSelected ? styles.convBtnSelected : ""
                  }`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <header className={listStyles.cardHead}>
                    <span className={listStyles.channel}>
                      {inquiryTypeLabel(conv.inquiry_type || "general")}
                    </span>
                    <time className={listStyles.time} dateTime={conv.updated_at}>
                      {formatDateTime(conv.updated_at || conv.created_at)}
                    </time>
                  </header>
                  <p className={listStyles.listingRef}>
                    {listingsById?.[conv.listing_id]?.title || `Listing ${conv.listing_id}`}
                  </p>
                  <p className={listStyles.body}>{conversationPreview(conv)}</p>
                </button>
              );
            })
          )}
        </div>

        <aside className={styles.detail} aria-label="Conversation detail">
          {selected ? (
            <>
              <header className={styles.detailHead}>
                <h3 className={styles.detailTitle}>{listingTitle}</h3>
                <p className={styles.detailMeta}>
                  {selected.buyer_name || selected.buyer_email || "Guest buyer"}
                  {selected.pipeline_stage ? ` · ${selected.pipeline_stage.replace(/_/g, " ")}` : ""}
                </p>
              </header>

              <dl className={listStyles.meta}>
                {selected.buyer_email ? (
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${encodeURIComponent(selected.buyer_email)}`}>
                        {selected.buyer_email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {selected.buyer_phone ? (
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.buyer_phone}</dd>
                  </div>
                ) : null}
              </dl>

              <div className={styles.thread} aria-live="polite" aria-busy={messagesLoading}>
                {messagesLoading ? (
                  <p className={styles.threadMuted}>Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className={styles.threadMuted}>No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${styles.bubble} ${
                        msg.sender_role === "agent" ? styles.bubbleAgent : styles.bubbleBuyer
                      }`}
                    >
                      <p className={styles.bubbleBody}>{msg.body}</p>
                      <time className={styles.bubbleTime} dateTime={msg.created_at}>
                        {formatDateTime(msg.created_at)}
                      </time>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.composer}>
                <label className={styles.composerLabel} htmlFor="inbox-reply">
                  Reply
                </label>
                <textarea
                  id="inbox-reply"
                  className={styles.composerInput}
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a calm, professional reply…"
                />
                <button
                  type="button"
                  className={listStyles.primary}
                  disabled={replyBusy || !replyBody.trim()}
                  onClick={handleSendReply}
                >
                  {replyBusy ? "Sending…" : "Send reply"}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.threadMuted}>Select a conversation to view the thread.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
