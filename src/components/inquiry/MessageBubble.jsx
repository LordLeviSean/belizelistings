import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { MESSAGE_SENDER_ROLE } from "@/lib/crm/crmConstants";
import styles from "./OwnerInquiriesPanel.module.css";

export default function MessageBubble({ message }) {
  const role = message?.sender_role;
  const isSystem = role === MESSAGE_SENDER_ROLE.SYSTEM;
  const isAgent = role === MESSAGE_SENDER_ROLE.AGENT;
  const bubbleClass = isSystem
    ? styles.bubbleSystem
    : isAgent
      ? styles.bubbleAgent
      : styles.bubbleBuyer;

  return (
    <div className={`${styles.bubble} ${bubbleClass}`}>
      <p className={styles.bubbleBody}>{message.body}</p>
      <time className={styles.bubbleTime} dateTime={message.created_at}>
        {formatRelativeTime(message.created_at)}
      </time>
    </div>
  );
}
