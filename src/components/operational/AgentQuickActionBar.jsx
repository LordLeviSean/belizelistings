import { Plus } from "lucide-react";
import opStyles from "./OperationalIntel.module.css";

/** Agent quick actions — only wired, production-ready flows. */
export default function AgentQuickActionBar({ onCreate }) {
  return (
    <nav className={opStyles.quickBar} aria-label="Quick actions">
      <button type="button" className={`${opStyles.quickBtn} ${opStyles.quickBtnPrimary}`} onClick={onCreate}>
        <Plus size={16} strokeWidth={2.25} aria-hidden />
        Create listing
      </button>
    </nav>
  );
}
