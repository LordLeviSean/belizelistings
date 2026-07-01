import { useCallback, useState } from "react";

/** @typedef {{ type: string, payload?: unknown }} ActiveModal */

export const MODAL_TYPES = {
  DELETE: "delete",
  ARCHIVE: "archive",
  EDIT: "edit",
  VIEW: "view",
  ADMIN_ACTION: "admin-action",
  SYSTEM: "system",
};

/**
 * Panel-scoped single-modal controller. Only one modal may be active at a time.
 */
export function useModalController() {
  const [activeModal, setActiveModal] = useState(null);

  const closeAllModals = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openModal = useCallback((type, payload = null) => {
    closeAllModals();
    setActiveModal({ type, payload });
  }, [closeAllModals]);

  const closeModal = useCallback((type) => {
    setActiveModal((current) => {
      if (!current) return null;
      if (type && current.type !== type) return current;
      return null;
    });
  }, []);

  const getActiveModal = useCallback(() => activeModal, [activeModal]);

  const isModalOpen = useCallback(
    (type) => activeModal?.type === type,
    [activeModal]
  );

  return {
    activeModal,
    openModal,
    closeModal,
    closeAllModals,
    getActiveModal,
    isModalOpen,
  };
}
