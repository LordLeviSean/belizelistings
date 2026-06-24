import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./AlreadySignedInModal.module.css";

export default function AlreadySignedInModal({
  open,
  onClose,
  onContinueSession,
  onSignOutAndSwitch,
  switchingOut,
}) {
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
      if (e.key === "Escape" && !switchingOut) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, switchingOut]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !switchingOut) onClose?.();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="already-signed-in-title"
      >
        <div className={styles.head}>
          <h2 id="already-signed-in-title" className={styles.title}>
            Already signed in
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            disabled={switchingOut}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={styles.body}>
          You are currently signed in. Would you like to continue with a different account?
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={switchingOut}
            onClick={() => onContinueSession?.()}
          >
            Continue current session
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={switchingOut}
            onClick={() => onSignOutAndSwitch?.()}
          >
            {switchingOut ? "Signing out…" : "Sign out & switch account"}
          </button>
        </div>
      </div>
    </div>
  );
}
