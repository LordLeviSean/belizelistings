import { formatRelativeTime } from "@/lib/formatRelativeTime";
import styles from "./OwnerInquiriesPanel.module.css";

export default function MessageBubble({ message }) {
  const isAgent = message?.sender_role === "agent";
  return (
    <div
      className={`${styles.bubble} ${isAgent ? styles.bubbleAgent : styles.bubbleBuyer}`}
    >
      <p className={styles.bubbleBody}>{message.body}</p>
      <time className={styles.bubbleTime} dateTime={message.created_at}>
        {formatRelativeTime(message.created_at)}
      </time>
    </div>
  );
}
