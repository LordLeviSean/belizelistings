import { memo, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  USER_ACCOUNT_ROLE_LABELS,
  USER_DASHBOARD_COPY,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
  USER_UPGRADE_PATHS,
  formatListingRemainingLabel,
} from "@/constants/dashboardUserConfig";
import { PUBLIC_ACTIVE_LISTING_CAP } from "@/constants/operationalModel";
import { AGENT_UPGRADE_TOAST } from "@/constants/agentUpgradeNotifications";
import {
  fetchPendingAgentUpgradeRequestForUser,
  submitAgentUpgradeRequest,
} from "@/lib/agentUpgradeRequests";
import { useToast } from "@/components/ui/ToastProvider";
import useUserRole from "@/hooks/useUserRole";
import AgentUpgradeConfirmModal from "./AgentUpgradeConfirmModal";
import UserUpgradePathModal from "./UserUpgradePathModal";
import styles from "@/styles/Dashboard.module.css";

function UserDashboardAccountTier({
  role = "user",
  tier,
  listingCap,
  activeListings,
  remainingListings,
  userId,
  username,
  email,
}) {
  const { showToast } = useToast();
  const { refetchProfile } = useUserRole();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(USER_UPGRADE_PATHS.AGENT);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const roleLabel = USER_ACCOUNT_ROLE_LABELS[role] || USER_ACCOUNT_ROLE_LABELS.user;
  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const capDisplay = finiteCap ? listingCap : PUBLIC_ACTIVE_LISTING_CAP;
  const used = Math.max(0, Number(activeListings) || 0);
  const remaining = Math.max(0, Number(remainingListings) || 0);
  const hasPendingUpgrade = Boolean(pendingRequest?.id);

  const refreshPending = useCallback(async () => {
    if (!userId || role !== "user") {
      setPendingRequest(null);
      return;
    }
    setPendingLoading(true);
    const { data, error } = await fetchPendingAgentUpgradeRequestForUser(userId);
    if (error) {
      console.warn("[user-dashboard-account-tier] pending request load", error);
    }
    setPendingRequest(data ?? null);
    setPendingLoading(false);
  }, [userId, role]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!userId || role !== "user") return undefined;
    const channel = supabase
      .channel(`user-agent-upgrade-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_upgrade_requests", filter: `user_id=eq.${userId}` },
        () => void refreshPending()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, role, refreshPending]);

  const openBrokerUpgrade = () => {
    setUpgradeTarget(USER_UPGRADE_PATHS.BROKER);
    setUpgradeOpen(true);
  };

  const openAgentUpgrade = () => {
    if (hasPendingUpgrade) {
      setConfirmOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmitAgentRequest = async () => {
    if (!userId || submitting || hasPendingUpgrade) return;
    setSubmitting(true);
    const { data, error } = await submitAgentUpgradeRequest({
      userId,
      username,
      email,
      currentRole: role,
    });
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const duplicate =
        error.code === "23505" || msg.includes("duplicate") || msg.includes("unique");
      showToast({
        type: duplicate ? "info" : "error",
        message: duplicate ? AGENT_UPGRADE_TOAST.DUPLICATE : AGENT_UPGRADE_TOAST.SUBMIT_ERROR,
      });
      if (duplicate) {
        await refreshPending();
      }
      setSubmitting(false);
      return;
    }
    setPendingRequest(data);
    showToast({ type: "success", message: AGENT_UPGRADE_TOAST.SUBMITTED });
    setConfirmOpen(false);
    setSubmitting(false);
    void refetchProfile?.();
  };

  return (
    <section className={styles.userTierBlock} aria-label="Account and listing capacity">
      <div className={styles.userTierHeader}>
        <h2 className={styles.userTierTitle}>{USER_DASHBOARD_COPY.accountTierHeadline}</h2>
        <p className={styles.userTierSubtext}>{USER_DASHBOARD_COPY.accountTierSubtext}</p>
      </div>

      <div className={styles.userTierGrid}>
        <div className={styles.userTierStat}>
          <span className={styles.userTierStatLabel}>Role</span>
          <span className={styles.userTierStatValue}>{roleLabel}</span>
        </div>
        <div className={styles.userTierStat}>
          <span className={styles.userTierStatLabel}>Active cap</span>
          <span className={styles.userTierStatValue}>{finiteCap ? capDisplay : "Unlimited"}</span>
        </div>
        <div className={styles.userTierStat}>
          <span className={styles.userTierStatLabel}>Used</span>
          <span className={styles.userTierStatValue}>{used}</span>
        </div>
        <div className={styles.userTierStat}>
          <span className={styles.userTierStatLabel}>Remaining</span>
          <span className={styles.userTierStatValue}>
            {finiteCap ? formatListingRemainingLabel(remaining) : "—"}
          </span>
        </div>
      </div>

      <p className={styles.userTierSummary}>
        {roleLabel} · {used} active
        {finiteCap ? ` · ${remaining} slot${remaining === 1 ? "" : "s"} left` : ""}
      </p>

      {hasPendingUpgrade ? (
        <p className={styles.userTierSummary} style={{ marginTop: 8 }}>
          {USER_DASHBOARD_COPY.agentUpgradePendingLabel}
        </p>
      ) : null}

      <div className={styles.userTierActions}>
        {role === "user" ? (
          <button
            type="button"
            className={styles.userUpgradeCta}
            onClick={openAgentUpgrade}
            disabled={pendingLoading}
          >
            {hasPendingUpgrade ? USER_DASHBOARD_COPY.agentUpgradePendingCta : USER_DASHBOARD_COPY.upgradeCta}
          </button>
        ) : null}
        {role === "agent" ? (
          <button type="button" className={styles.userUpgradeCta} onClick={openBrokerUpgrade}>
            {USER_DASHBOARD_COPY.upgradeToBrokerCta}
          </button>
        ) : null}
        {role === "broker" ? (
          <span className={styles.userTierBrokerPlaceholder}>
            Brokerage tools and team scope — overview coming soon.
          </span>
        ) : null}
      </div>

      <AgentUpgradeConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onSubmit={handleSubmitAgentRequest}
        submitting={submitting}
        pending={hasPendingUpgrade}
      />

      <UserUpgradePathModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        targetTier={upgradeTarget}
      />
    </section>
  );
}

export default memo(UserDashboardAccountTier);
