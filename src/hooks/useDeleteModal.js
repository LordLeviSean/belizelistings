import { useCallback } from "react";
import { MODAL_TYPES, useModalController } from "./useModalController";

/**
 * Delete-modal helpers composed on a modal controller.
 * Pass a shared controller from useModalController() when the panel manages multiple modals.
 */
export function useDeleteModal(externalController) {
  const internalController = useModalController();
  const modal = externalController ?? internalController;

  const active = modal.getActiveModal();
  const isOpen = modal.isModalOpen(MODAL_TYPES.DELETE);
  const target = isOpen ? active?.payload ?? null : null;

  const openDelete = useCallback(
    (item, { onBeforeOpen } = {}) => {
      onBeforeOpen?.();
      modal.closeAllModals();
      modal.openModal(MODAL_TYPES.DELETE, item);
    },
    [modal]
  );

  const closeDelete = useCallback(() => {
    modal.closeModal(MODAL_TYPES.DELETE);
  }, [modal]);

  const setTarget = useCallback(
    (item) => {
      if (item == null) {
        closeDelete();
        return;
      }
      modal.closeAllModals();
      modal.openModal(MODAL_TYPES.DELETE, item);
    },
    [modal, closeDelete]
  );

  return {
    isOpen,
    target,
    openDelete,
    closeDelete,
    setTarget,
  };
}
