import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./ListingInteractionModal.module.css";

/**
 * Unified listing interaction modal shell.
 *
 * Standard for Contact Agent, Schedule Viewing, and future Share / Report / Save Search modals.
 * Props: isOpen, onClose, title, children, footer (optional), compact (optional).
 */
export default function ListingInteractionModal({
  isOpen,
  onClose,
  title,
  titleId: titleIdProp,
  children,
  footer = null,
  compact = false,
  panelClassName = "",
  onEscape,
  dismissOnBackdrop = true,
}) {
  const autoTitleId = useId();
  const titleId = titleIdProp || autoTitleId;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (typeof onEscape === "function") {
        onEscape();
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, onEscape]);

  if (!isOpen || !mounted) return null;

  const backdropClass = [styles.backdrop, compact ? styles.backdropCompact : ""].filter(Boolean).join(" ");
  const panelClass = [styles.panel, panelClassName].filter(Boolean).join(" ");

  return createPortal(
    <div
      className={backdropClass}
      role="presentation"
      onMouseDown={(e) => {
        if (!dismissOnBackdrop) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={panelClass} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => onClose?.()}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
