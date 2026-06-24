import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import {
  AGENT_UPGRADE_ADMIN_TOAST,
  AGENT_UPGRADE_REQUEST_STATUS,
} from "@/constants/agentUpgradeNotifications";
import {
  fetchPendingAgentUpgradeRequests,
  resolveAgentUpgradeRequest,
} from "@/lib/agentUpgradeRequests";
import { formatProfileDisplayLabel } from "@/lib/profileDisplayName";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import styles from "@/styles/Dashboard.module.css";

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AgentUpgradeRequestsPanel({ onAction, requestsRevision = 0 }) {
  const { user } = useUserRole();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error, unavailable: missingTable } = await fetchPendingAgentUpgradeRequests();
    if (missingTable) {
      setUnavailable(true);
      setRows([]);
      setLoading(false);
      return;
    }
    if (error) {
      console.warn("[agent-upgrade-requests] load failed", error);
    }
    setUnavailable(false);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, requestsRevision]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-agent-upgrade-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_upgrade_requests" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const handleResolve = async (row, nextStatus) => {
    if (!user?.id || actionId) return;
    setActionId(String(row.id));
    const result = await resolveAgentUpgradeRequest({
      requestId: row.id,
      reviewerId: user.id,
      nextStatus,
      userId: row.user_id,
    });
    if (!result.ok) {
      console.warn("[agent-upgrade-requests] resolve failed", result.error);
      showToast({ type: "error", message: AGENT_UPGRADE_ADMIN_TOAST.ACTION_ERROR });
      setActionId("");
      return;
    }
    await load();
    const label = formatProfileDisplayLabel({ username: row.username, email: row.email });
    onAction?.(
      nextStatus === AGENT_UPGRADE_REQUEST_STATUS.APPROVED
        ? `Approved Agent upgrade for ${label}`
        : `Rejected Agent upgrade for ${label}`
    );
    showToast({
      type: "success",
      message:
        nextStatus === AGENT_UPGRADE_REQUEST_STATUS.APPROVED
          ? AGENT_UPGRADE_ADMIN_TOAST.APPROVED
          : AGENT_UPGRADE_ADMIN_TOAST.REJECTED,
    });
    setActionId("");
  };

  if (unavailable) {
    return (
      <PremiumEmptyState
        variant="activity"
        title="Upgrade queue unavailable"
        hint="Apply supabase/migrations/20260623120000_agent_upgrade_requests.sql, then refresh."
      />
    );
  }

  if (loading) {
    return <p className={styles.muted}>Loading upgrade requests…</p>;
  }

  if (!rows.length) {
    return (
      <PremiumEmptyState
        variant="activity"
        title="No pending Agent upgrades"
        hint="When platform users request Agent access, they appear here for review."
      />
    );
  }

  return (
    <div className={styles.card} style={{ marginTop: 12 }}>
      <h3 className={styles.sectionTitle}>Agent upgrade requests</h3>
      <p className={styles.muted} style={{ marginBottom: 12 }}>
        Approve to grant Agent role and listing capacity. Reject to close the request.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {rows.map((row) => {
          const label = formatProfileDisplayLabel({ username: row.username, email: row.email });
          const busy = actionId === String(row.id);
          return (
            <li
              key={row.id}
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.72)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 650, fontSize: 13 }}>{label}</p>
                  <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 12 }}>
                    Requested {formatWhen(row.requested_at)} · {row.current_user_role || "user"} → agent
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className={styles.approveButton}
                    disabled={busy}
                    onClick={() => void handleResolve(row, AGENT_UPGRADE_REQUEST_STATUS.APPROVED)}
                  >
                    {busy ? "Processing…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.rejectButton}
                    disabled={busy}
                    onClick={() => void handleResolve(row, AGENT_UPGRADE_REQUEST_STATUS.REJECTED)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
