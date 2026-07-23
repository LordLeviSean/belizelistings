import { useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "./DeleteConfirmationModal.module.css";

const DELETE_KEYWORD = "delete";

function resolveItemTitle(item) {
  if (!item) return "";
  if (typeof item === "string") return "";
  return String(item.title || item.name || "").trim();
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  item = null,
  title = "Delete Listing?",
  warningText = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  requireTypeDelete = false,
}) {
  const [inputValue, setInputValue] = useState("");
  const itemTitle = resolveItemTitle(item);

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

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
      if (e.key === "Escape" && !loading) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const canConfirm =
    !loading &&
    (!requireTypeDelete || inputValue.trim().toLowerCase() === DELETE_KEYWORD);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.();
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
      >
        <div className={styles.head}>
          <h2 id="delete-confirmation-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={loading}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <p className={styles.body}>{warningText}</p>
        {itemTitle ? <p className={styles.itemTitle}>{itemTitle}</p> : null}

        {requireTypeDelete ? (
          <>
            <p className={styles.typeConfirm}>
              Type <strong>{DELETE_KEYWORD}</strong> to confirm.
            </p>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Type "${DELETE_KEYWORD}"`}
              className={styles.input}
              disabled={loading}
              autoComplete="off"
              aria-label={`Type ${DELETE_KEYWORD} to confirm deletion`}
            />
          </>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={loading}
            onClick={() => onClose?.()}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.btnDestructive}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
