import { useEffect } from "react";
import { AGENT_ACTIVE_LISTING_CAP } from "@/constants/listingTierCaps";
import { USER_DASHBOARD_COPY } from "@/constants/dashboardUserConfig";
import modalStyles from "./UserUpgradePathModal.module.css";

export default function AgentUpgradeConfirmModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  pending = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  return (
    <div
      className={modalStyles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
    >
      <div
        className={modalStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-upgrade-confirm-title"
      >
        <h2 id="agent-upgrade-confirm-title" className={modalStyles.headline}>
          {pending ? "Agent upgrade pending" : "Request Agent access"}
        </h2>
        <p className={modalStyles.subtext}>
          {pending
            ? "Your request is in review. We will notify you when an administrator has processed it."
            : `Agent accounts unlock professional tools and up to ${AGENT_ACTIVE_LISTING_CAP} simultaneous active listings.`}
        </p>

        {!pending ? (
          <p className={modalStyles.note}>
            {USER_DASHBOARD_COPY.upgradeAgentHint} Submitting sends your request to the BelizeListings
            team for review.
          </p>
        ) : null}

        <div className={modalStyles.closeRow}>
          {pending ? (
            <button type="button" className={modalStyles.closeBtn} onClick={() => onClose?.()}>
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className={modalStyles.closeBtn}
                disabled={submitting}
                onClick={() => onClose?.()}
              >
                Cancel
              </button>
              <button
                type="button"
                className={modalStyles.closeBtn}
                disabled={submitting}
                style={{ marginLeft: 8, borderColor: "rgba(46, 139, 120, 0.45)", color: "rgba(32, 68, 62, 0.94)" }}
                onClick={() => onSubmit?.()}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
