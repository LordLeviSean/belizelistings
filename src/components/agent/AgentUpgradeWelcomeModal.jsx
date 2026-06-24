import { useEffect } from "react";
import { AGENT_BENEFITS, AGENT_DASHBOARD_COPY } from "@/constants/dashboardAgentConfig";
import modalStyles from "@/components/user/UserUpgradePathModal.module.css";

export default function AgentUpgradeWelcomeModal({ open, onDismiss }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className={modalStyles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div
        className={modalStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-welcome-title"
      >
        <h2 id="agent-welcome-title" className={modalStyles.headline}>
          {AGENT_DASHBOARD_COPY.welcomeModalTitle}
        </h2>
        <p className={modalStyles.subtext}>{AGENT_DASHBOARD_COPY.welcomeModalSubtext}</p>
        <ul className={modalStyles.note} style={{ marginTop: 12, paddingLeft: 18 }}>
          {AGENT_BENEFITS.map((item) => (
            <li key={item} style={{ marginBottom: 6 }}>
              {item}
            </li>
          ))}
        </ul>
        <div className={modalStyles.closeRow}>
          <button type="button" className={modalStyles.closeBtn} onClick={() => onDismiss?.()}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
