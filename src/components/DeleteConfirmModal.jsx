import { useEffect, useState } from "react";
import styles from "./DeleteConfirmModal.module.css";

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, loading = false }) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = inputValue.trim().toLowerCase() === "delete" && !loading;

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
        <h3>Delete Listing</h3>
        <p>
          Type <strong>delete</strong> to permanently remove this listing.
        </p>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='Type "delete"'
          className={styles.input}
        />

        <div className={styles.actions}>
          <button type="button" onClick={handleClose} className={styles.cancelButton}>
            Cancel
          </button>

          <button type="button" onClick={handleConfirm} disabled={!canConfirm} className={styles.deleteButton}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
