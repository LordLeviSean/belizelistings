import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./DiscardDraftModal.module.css";

export default function DiscardDraftModal({ open, onClose, onDiscard, discarding }) {
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
      if (e.key === "Escape" && !discarding) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, discarding]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !discarding) onClose?.();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-draft-title"
      >
        <div className={styles.head}>
          <h2 id="discard-draft-title" className={styles.title}>
            Discard this draft?
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={discarding}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={styles.body}>
          This draft will be permanently removed. This action cannot be undone.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={discarding}
            onClick={() => onClose?.()}
          >
            Keep Draft
          </button>
          <button
            type="button"
            className={styles.btnDestructive}
            disabled={discarding}
            onClick={() => onDiscard?.()}
          >
            {discarding ? "Discarding…" : "Discard Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
