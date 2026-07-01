import DeleteConfirmationModal from "./DeleteConfirmationModal";

/** @deprecated Prefer DeleteConfirmationModal — thin wrapper for backward compatibility. */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  mode = "delete",
  title,
  description,
  confirmLabel,
  item,
}) {
  return (
    <DeleteConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      item={item}
      loading={loading}
      title={title || (mode === "delete" ? "Delete Listing?" : "Confirm action")}
      warningText={
        description ||
        "This action cannot be undone."
      }
      confirmLabel={confirmLabel || (mode === "delete" ? "Delete" : "Confirm")}
      requireTypeDelete={mode === "delete"}
    />
  );
}
