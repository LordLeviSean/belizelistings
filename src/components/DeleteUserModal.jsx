import { useEffect, useRef, useState } from "react";
import {
  Heart,
  Home,
  Lock,
  MessageCircle,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import styles from "./DeleteUserModal.module.css";

const CONFIRM_KEYWORD = "DELETE";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const REMOVAL_ITEMS = [
  { label: "Profile & sign-in", Icon: User },
  { label: "All listings & media", Icon: Home },
  { label: "Favorites & notifications", Icon: Heart },
  { label: "Inbox & inquiries", Icon: MessageCircle },
  { label: "Agent requests", Icon: Shield },
];

export default function DeleteUserModal({
  open,
  user,
  busy = false,
  onClose,
  onConfirm,
}) {
  const modalRef = useRef(null);
  const confirmInputRef = useRef(null);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open || !modalRef.current) return undefined;
    const modal = modalRef.current;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    confirmInputRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key !== "Tab" || focusables.length === 0) return;
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    modal.addEventListener("keydown", onKeyDown);
    return () => modal.removeEventListener("keydown", onKeyDown);
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
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) handleClose();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        aria-describedby="delete-user-removal-summary delete-user-undo-note"
      >
        <div className={styles.head}>
          <h2 id="delete-user-title" className={styles.title}>
            Delete User?
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={busy}
            onClick={handleClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.identityBlock}>
            <div className={styles.identity}>
              <span className={styles.identityLabel}>Username</span>
              <span className={styles.identityValue} title={displayUsername}>
                {displayUsername}
              </span>
            </div>
            <div className={styles.identity}>
              <span className={styles.identityLabel}>Email</span>
              <span className={styles.identityValue} title={displayEmail}>
                {displayEmail}
              </span>
            </div>
          </div>

          <div id="delete-user-removal-summary" className={styles.removalSection}>
            <p className={styles.removalHeading}>This will permanently remove:</p>
            <ul className={styles.removalGrid}>
              {REMOVAL_ITEMS.map(({ label, Icon }) => (
                <li key={label} className={styles.removalItem}>
                  <Icon className={styles.removalIcon} size={16} strokeWidth={2} aria-hidden />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.formFields}>
            <label className={styles.fieldLabel} htmlFor="delete-user-confirm">
              Type <strong>{CONFIRM_KEYWORD}</strong> to continue
            </label>
            <input
              ref={confirmInputRef}
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
              rows={3}
              disabled={busy}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <p id="delete-user-undo-note" className={styles.undoNote}>
            <Lock className={styles.undoIcon} size={15} strokeWidth={2} aria-hidden />
            This action cannot be undone.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelButton}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={styles.deleteButton}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden />
              {busy ? "Processing…" : "Permanently Delete User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
