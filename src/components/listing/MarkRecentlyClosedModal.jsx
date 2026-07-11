import { useEffect, useRef } from "react";
import { Tag, X } from "lucide-react";
import { RECENTLY_CLOSED_DISPLAY_DAYS } from "@/constants/listingClosedLifecycle";
import styles from "./ArchiveListingModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MarkRecentlyClosedModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  mode = "sold",
  listingTitle = "",
}) {
  const modalRef = useRef(null);
  const confirmRef = useRef(null);
  const isRent = mode === "rented";
  const headline = isRent ? "Mark this property as rented?" : "Mark this property as sold?";
  const confirmLabel = isRent ? "Mark Recently Rented" : "Mark Recently Sold";

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
      if (e.key === "Escape" && !isSubmitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isSubmitting]);

  useEffect(() => {
    if (!open || !modalRef.current) return undefined;
    const modal = modalRef.current;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    confirmRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Enter" && !isSubmitting) {
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
  }, [open, isSubmitting, onConfirm]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-recently-closed-title"
        aria-describedby="mark-recently-closed-desc mark-recently-closed-helper"
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.iconGlow} />
          <Tag className={styles.icon} size={22} strokeWidth={2} />
        </div>

        <div className={styles.head}>
          <h2 id="mark-recently-closed-title" className={styles.title}>
            {headline}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={isSubmitting}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {listingTitle ? (
          <p className={styles.body}>
            <strong>{listingTitle}</strong>
          </p>
        ) : null}

        <p id="mark-recently-closed-desc" className={styles.body}>
          The listing will remain visible as &ldquo;{isRent ? "Recently Rented" : "Recently Sold"}&rdquo; for{" "}
          {RECENTLY_CLOSED_DISPLAY_DAYS} days. New inquiries and viewing requests will be disabled.
        </p>
        <p id="mark-recently-closed-helper" className={styles.helper}>
          Existing conversations and viewing history stay accessible. After the display period, archive the listing
          from your dashboard when you are ready.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={isSubmitting}
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.btnPrimary}
            disabled={isSubmitting}
            onClick={() => onConfirm?.()}
          >
            {isSubmitting ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
