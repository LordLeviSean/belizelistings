import { useEffect, useState } from "react";
import styles from "./DeleteUserModal.module.css";

const CONFIRM_KEYWORD = "DELETE";

export default function DeleteUserModal({
  open,
  user,
  busy = false,
  onClose,
  onConfirm,
}) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setReason("");
    }
  }, [open]);

  if (!open || !user) return null;

  const canConfirm =
    confirmText.trim().toUpperCase() === CONFIRM_KEYWORD && !busy;

  const handleClose = () => {
    if (busy) return;
    onClose?.();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.({ reason: reason.trim() });
  };

  const displayUsername = user.username || user.full_name || "—";
  const displayEmail = user.email || "—";

  return (
    <div className={styles.backdrop} role="presentation" onClick={handleClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="delete-user-title" className={styles.title}>
          Delete User?
        </h3>

        <div className={styles.identityBlock}>
          <div className={styles.identity}>
            <span className={styles.identityLabel}>Username</span>
            {displayUsername}
          </div>
          <div className={styles.identity}>
            <span className={styles.identityLabel}>Email</span>
            {displayEmail}
          </div>
        </div>

        <p className={styles.warning}>
          This permanently removes the account and cannot be undone. The following will be
          deleted:
        </p>
        <ul className={styles.checklist}>
          <li>Profile and sign-in access</li>
          <li>All listings, images, and listing history</li>
          <li>Favorites, saved searches on this device, and notifications</li>
          <li>Inquiries, conversations, and viewing requests</li>
          <li>Agent requests and upgrade requests</li>
        </ul>

        <label className={styles.fieldLabel} htmlFor="delete-user-confirm">
          Type <strong>{CONFIRM_KEYWORD}</strong> to continue
        </label>
        <input
          id="delete-user-confirm"
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder={`Type "${CONFIRM_KEYWORD}"`}
          className={styles.input}
          autoComplete="off"
          disabled={busy}
        />

        <label className={styles.fieldLabel} htmlFor="delete-user-reason">
          Reason (optional)
        </label>
        <textarea
          id="delete-user-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Internal note for audit log"
          className={styles.textarea}
          disabled={busy}
        />

        <div className={styles.actions}>
          <button type="button" onClick={handleClose} className={styles.cancelButton} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={styles.deleteButton}
          >
            {busy ? "Processing…" : "Permanently Delete User"}
          </button>
        </div>
      </div>
    </div>
  );
}
