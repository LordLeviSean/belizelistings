import { useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import styles from "../listing/ArchiveListingModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Reusable admin trust/lifecycle confirm dialog — ArchiveListingModal pattern.
 * Future actions (feature, publish, mark sold) can share this shell.
 */
export default function AdminListingActionConfirmModal({
  open,
  title,
  body,
  helper,
  confirmLabel = "Confirm",
  busy = false,
  onClose,
  onConfirm,
}) {
  const modalRef = useRef(null);
  const confirmRef = useRef(null);

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
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose?.();
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
    confirmRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Enter" && !busy) {
        e.preventDefault();
        onConfirm?.();
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    modal.addEventListener("keydown", onKeyDown);
    return () => modal.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onConfirm]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-listing-action-title"
        aria-describedby="admin-listing-action-desc admin-listing-action-helper"
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.iconGlow} />
          <ShieldCheck className={styles.icon} size={22} strokeWidth={2} />
        </div>

        <div className={styles.head}>
          <h2 id="admin-listing-action-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={busy}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <p id="admin-listing-action-desc" className={styles.body}>
          {body}
        </p>
        {helper ? (
          <p id="admin-listing-action-helper" className={styles.helper}>
            {helper}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={busy}
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.btnPrimary}
            disabled={busy}
            onClick={() => onConfirm?.()}
          >
            {busy ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
