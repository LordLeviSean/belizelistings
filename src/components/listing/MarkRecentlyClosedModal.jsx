import { useEffect, useRef } from "react";
import { KeyRound, Tag, X } from "lucide-react";
import styles from "./ArchiveListingModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MarkRecentlyClosedModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  action = null,
  listingTitle = "",
}) {
  const modalRef = useRef(null);
  const confirmRef = useRef(null);
  const isRent = action?.buttonVariant === "rented";
  const headline = action?.confirmationTitle || (isRent ? "Mark this listing as rented?" : "Mark this listing as sold?");
  const confirmLabel = action?.confirmationPrimaryLabel || (isRent ? "Mark Rented" : "Mark Sold");
  const bodyCopy =
    action?.confirmationBody ||
    (isRent
      ? "This will remove the property from active rental listings and show it as Rented."
      : "This will remove the property from active sale listings and show it as Sold.");
  const resultLabel = action?.resultBadgeLabel || (isRent ? "Rented" : "Sold");

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

  if (!open || !action) return null;

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
          <span className={`${styles.iconGlow} ${isRent ? styles.iconGlowRented : ""}`} />
          {isRent ? (
            <KeyRound className={`${styles.icon} ${styles.iconRented}`} size={22} strokeWidth={2} />
          ) : (
            <Tag className={styles.icon} size={22} strokeWidth={2} />
          )}
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
          {bodyCopy}
        </p>
        <p id="mark-recently-closed-helper" className={styles.helper}>
          Existing conversations and viewing history stay accessible. The listing badge will show as{" "}
          {resultLabel}.
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
            className={isRent ? styles.btnPrimaryRented : styles.btnPrimarySold}
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
