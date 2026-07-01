import Link from "next/link";
import styles from "./ProfileCompletionGateModal.module.css";

export default function ProfileCompletionGateModal({ open, onClose, profileHref }) {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="profile-gate-title">
        <h2 id="profile-gate-title" className={styles.title}>
          Complete your profile first
        </h2>
        <p className={styles.body}>
          A phone number on your BelizeListings profile is required before you can submit a listing
          for review. Contact details live on your profile — not on individual listings.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href={profileHref} onClick={() => onClose?.()}>
            Go to profile
          </Link>
          <button type="button" className={styles.secondary} onClick={() => onClose?.()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
