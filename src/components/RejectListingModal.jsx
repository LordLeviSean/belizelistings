import { useEffect, useState } from "react";
import dashboardStyles from "../styles/Dashboard.module.css";
import styles from "./RejectListingModal.module.css";

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(reason: string) => void | Promise<void>} props.onConfirm
 * @param {boolean} [props.loading]
 */
export default function RejectListingModal({ isOpen, onClose, onConfirm, loading = false }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={handleClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-listing-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reject-listing-title" className={styles.title}>
          Reject listing
        </h2>
        <p className={styles.hint}>A reason is required. It may be shown to the listing owner.</p>
        <textarea
          id="reject-reason"
          className={styles.textarea}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this listing is being rejected…"
          disabled={loading}
          required
          aria-required="true"
          aria-label="Rejection reason"
        />
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={dashboardStyles.rejectButton}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? "Rejecting…" : "Reject Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
