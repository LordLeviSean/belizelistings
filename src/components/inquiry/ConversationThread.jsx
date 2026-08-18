import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import { formatPipelineStageLabel } from "@/lib/crm/conversationCrmShape";
import styles from "./OwnerInquiriesPanel.module.css";

export default function ConversationThread({
  conversation,
  listingTitle,
  messages = [],
  messagesLoading = false,
  replyBody,
  onReplyChange,
  onSendReply,
  replyBusy = false,
  showBack = false,
  onBack,
  backLabel = "Back",
  onDelete = null,
}) {
  if (!conversation) {
    return <p className={styles.threadMuted}>Select a conversation to view the thread.</p>;
  }

  const buyerLabel =
    conversation.buyer_name || conversation.buyer_email || "Guest buyer";

  return (
    <>
      {showBack ? (
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← {backLabel}
        </button>
      ) : null}

      <header className={styles.detailHead}>
        <h3 className={styles.detailTitle}>{listingTitle}</h3>
        <p className={styles.detailMeta}>
          {buyerLabel}
          {conversation.pipeline_stage
            ? ` · ${formatPipelineStageLabel(conversation.pipeline_stage, { fallback: "" })}`
            : ""}
        </p>
      </header>

      {onDelete ? (
        <div className={styles.threadActions}>
          <button type="button" className={styles.deleteBtn} onClick={onDelete}>
            Delete conversation
          </button>
        </div>
      ) : null}

      <dl className={styles.contactMeta}>
        {conversation.buyer_email ? (
          <div>
            <dt>Email</dt>
            <dd>{conversation.buyer_email}</dd>
          </div>
        ) : null}
        {conversation.buyer_phone ? (
          <div>
            <dt>Phone</dt>
            <dd>{conversation.buyer_phone}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.thread} aria-live="polite" aria-busy={messagesLoading}>
        {messagesLoading ? (
          <p className={styles.threadMuted}>Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className={styles.threadMuted}>No messages yet.</p>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      <MessageComposer
        value={replyBody}
        onChange={onReplyChange}
        onSend={onSendReply}
        busy={replyBusy}
      />
    </>
  );
}
