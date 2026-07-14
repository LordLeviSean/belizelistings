import listStyles from "./AgentInquiryList.module.css";
import styles from "./OwnerInquiriesPanel.module.css";

export default function MessageComposer({
  id = "inbox-reply",
  label = "Reply",
  placeholder = "Write a calm, professional reply…",
  value,
  onChange,
  onSend,
  busy = false,
  sendLabel = "Send reply",
}) {
  return (
    <div className={styles.composer}>
      <label className={styles.composerLabel} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.composerInput}
        rows={3}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        className={listStyles.primary}
        disabled={busy || !String(value || "").trim()}
        onClick={onSend}
      >
        {busy ? "Sending…" : sendLabel}
      </button>
    </div>
  );
}
