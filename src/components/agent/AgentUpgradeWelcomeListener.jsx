import { useCallback, useEffect, useState } from "react";
import useUserRole from "@/hooks/useUserRole";
import AgentUpgradeWelcomeModal from "@/components/agent/AgentUpgradeWelcomeModal";
import {
  emitAgentUpgradeApproved,
  markAgentWelcomeSeen,
  onAgentUpgradeApproved,
  shouldShowAgentWelcomeModal,
} from "@/lib/agentUpgradeWelcome";

/**
 * Global one-time welcome modal after admin approves agent upgrade.
 */
export default function AgentUpgradeWelcomeListener() {
  const { user, role } = useUserRole();
  const [open, setOpen] = useState(false);

  const maybeOpen = useCallback(
    (userId) => {
      if (!userId || role !== "agent") return;
      if (shouldShowAgentWelcomeModal(userId)) {
        setOpen(true);
      }
    },
    [role]
  );

  useEffect(() => {
    if (!user?.id || role !== "agent") return;
    maybeOpen(user.id);
  }, [user?.id, role, maybeOpen]);

  useEffect(() => {
    return onAgentUpgradeApproved((userId) => {
      if (user?.id && String(user.id) === String(userId)) {
        maybeOpen(userId);
      }
    });
  }, [user?.id, maybeOpen]);

  const dismiss = () => {
    if (user?.id) markAgentWelcomeSeen(user.id);
    setOpen(false);
  };

  return <AgentUpgradeWelcomeModal open={open} onDismiss={dismiss} />;
}
