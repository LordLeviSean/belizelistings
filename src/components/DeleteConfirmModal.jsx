import { useEffect, useState } from "react";
import styles from "./DeleteConfirmModal.module.css";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  mode = "archive",
  title,
  description,
  confirmLabel,
  confirmKeyword,
}) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const keyword = String(confirmKeyword || (mode === "delete" ? "delete" : "archive")).toLowerCase();
  const canConfirm = inputValue.trim().toLowerCase() === keyword && !loading;

  const handleClose = () => {
    setInputValue("");
    onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3>{title || (mode === "delete" ? "Delete Listing" : "Archive Listing")}</h3>
        <p>
          {description || (
            <>
              Type <strong>{keyword}</strong>{" "}
              {mode === "delete"
                ? "to permanently remove this listing."
                : "to safely hide this listing from public inventory."}
            </>
          )}
        </p>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Type "${keyword}"`}
          className={styles.input}
        />

        <div className={styles.actions}>
          <button type="button" onClick={handleClose} className={styles.cancelButton}>
            Cancel
          </button>

          <button type="button" onClick={handleConfirm} disabled={!canConfirm} className={styles.deleteButton}>
            {loading ? "Processing..." : confirmLabel || (mode === "delete" ? "Delete" : "Archive")}
          </button>
        </div>
      </div>
    </div>
  );
}
