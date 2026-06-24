import { useCallback } from "react";
import { useRouter } from "next/router";
import {
  USER_DASHBOARD_COPY,
  USER_UPGRADE_PATHS,
} from "@/constants/dashboardUserConfig";
import modalStyles from "./UserUpgradePathModal.module.css";

export default function UserUpgradePathModal({ open, onClose, targetTier = USER_UPGRADE_PATHS.AGENT }) {
  const router = useRouter();

  const goAgents = useCallback(() => {
    onClose?.();
    router.push("/agents");
  }, [onClose, router]);

  if (!open) return null;

  const showBrokerNote = targetTier === USER_UPGRADE_PATHS.BROKER;

  return (
    <div
      className={modalStyles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={modalStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-upgrade-path-title"
      >
        <h2 id="user-upgrade-path-title" className={modalStyles.headline}>
          {USER_DASHBOARD_COPY.upgradePathHeadline}
        </h2>
        <p className={modalStyles.subtext}>{USER_DASHBOARD_COPY.upgradePathSubtext}</p>

        <div className={modalStyles.options}>
          <button type="button" className={modalStyles.optionBtn} onClick={goAgents}>
            <p className={modalStyles.optionTitle}>{USER_DASHBOARD_COPY.upgradeAgentLabel}</p>
            <p className={modalStyles.optionHint}>{USER_DASHBOARD_COPY.upgradeAgentHint}</p>
          </button>
          <button type="button" className={modalStyles.optionBtn} onClick={goAgents}>
            <p className={modalStyles.optionTitle}>{USER_DASHBOARD_COPY.upgradeBrokerLabel}</p>
            <p className={modalStyles.optionHint}>{USER_DASHBOARD_COPY.upgradeBrokerHint}</p>
          </button>
          <button type="button" className={modalStyles.optionBtn} disabled>
            <p className={modalStyles.optionTitle}>{USER_DASHBOARD_COPY.upgradeDeveloperLabel}</p>
            <p className={modalStyles.optionHint}>
              {USER_DASHBOARD_COPY.upgradeDeveloperHint} · {USER_DASHBOARD_COPY.placeholderComingSoon}
            </p>
          </button>
        </div>

        {showBrokerNote ? (
          <p className={modalStyles.note}>{USER_DASHBOARD_COPY.brokerVerificationNote}</p>
        ) : null}

        <div className={modalStyles.closeRow}>
          <button type="button" className={modalStyles.closeBtn} onClick={() => onClose?.()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
