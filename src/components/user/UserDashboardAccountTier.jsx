import { memo, useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  USER_DASHBOARD_COPY,
  USER_DASHBOARD_FINITE_CAP_THRESHOLD,
  USER_UPGRADE_PATHS,
  formatUserListingLimitMaximumReached,
  formatUserListingLimitUpgradeHint,
  formatUserListingSlotsUsedLabel,
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
  limitExhausted = false,
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

  const finiteCap = listingCap < USER_DASHBOARD_FINITE_CAP_THRESHOLD;
  const capDisplay = finiteCap ? listingCap : PUBLIC_ACTIVE_LISTING_CAP;
  const used = Math.max(0, Number(activeListings) || 0);
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

  const listingLimitAccessibleLabel = limitExhausted
    ? `${formatUserListingSlotsUsedLabel(used, capDisplay)}. ${formatUserListingLimitMaximumReached(capDisplay)}. ${formatUserListingLimitUpgradeHint()}`
    : `${formatUserListingSlotsUsedLabel(used, capDisplay)}. ${USER_DASHBOARD_COPY.listingLimitSubtext}`;

  return (
    <section className={styles.userTierBlock} aria-label="Account and listing capacity">
      <div className={styles.userTierHeader}>
        <h2 className={styles.userTierTitle}>{USER_DASHBOARD_COPY.accountTierHeadline}</h2>
        <p className={styles.userTierSubtext}>{USER_DASHBOARD_COPY.accountTierSubtext}</p>
      </div>

      {finiteCap ? (
        <div
          className={`${styles.userListingLimitPanel} ${
            limitExhausted ? styles.userListingLimitPanelExhausted : ""
          }`}
          aria-label={listingLimitAccessibleLabel}
        >
          <div className={styles.userListingLimitCopy}>
            <p className={styles.userListingLimitLabel}>{USER_DASHBOARD_COPY.listingLimitPanelLabel}</p>
            <p className={styles.userListingLimitSlots} aria-hidden="true">
              {formatUserListingSlotsUsedLabel(used, capDisplay)}
            </p>
            {limitExhausted ? (
              <>
                <p className={styles.userListingLimitStatus} aria-hidden="true">
                  {formatUserListingLimitMaximumReached(capDisplay)}
                </p>
                <p className={styles.userListingLimitHint} aria-hidden="true">
                  {formatUserListingLimitUpgradeHint()}
                </p>
              </>
            ) : (
              <p className={styles.userListingLimitHint} aria-hidden="true">
                {USER_DASHBOARD_COPY.listingLimitSubtext}
              </p>
            )}
          </div>
          <Gauge className={styles.userListingLimitGauge} aria-hidden />
        </div>
      ) : null}

      {hasPendingUpgrade ? (
        <p className={styles.userTierSummary} style={{ marginTop: 12 }}>
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
