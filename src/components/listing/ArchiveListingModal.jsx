import { useEffect, useRef } from "react";
import { Archive, X } from "lucide-react";
import styles from "./ArchiveListingModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ArchiveListingModal({ open, onClose, onConfirm, isArchiving = false }) {
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
      if (e.key === "Escape" && !isArchiving) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isArchiving]);

  useEffect(() => {
    if (!open || !modalRef.current) return undefined;
    const modal = modalRef.current;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    confirmRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Enter" && !isArchiving) {
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
  }, [open, isArchiving, onConfirm]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isArchiving) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-listing-title"
        aria-describedby="archive-listing-desc archive-listing-helper"
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.iconGlow} />
          <Archive className={styles.icon} size={22} strokeWidth={2} />
        </div>

        <div className={styles.head}>
          <h2 id="archive-listing-title" className={styles.title}>
            Archive this listing?
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={isArchiving}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <p id="archive-listing-desc" className={styles.body}>
          This listing will be moved to your Archived Listings. It will be removed from public
          visibility and become inactive across the platform.
        </p>
        <p id="archive-listing-helper" className={styles.helper}>
          You can restore or re-publish this listing later.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={isArchiving}
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.btnPrimary}
            disabled={isArchiving}
            onClick={() => onConfirm?.()}
          >
            {isArchiving ? "Archiving…" : "Archive Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
