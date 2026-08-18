import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DELIVERY_MODES } from "@/lib/admin/notificationDiagnostics";
import {
  formatNotificationDiagnosticTrace,
  formatNotificationDiagnosticsReport,
} from "@/lib/admin/notificationDiagnosticTraceFormat";
import { copyDiagnosticTextToClipboard } from "@/lib/admin/copyDiagnosticClipboard";
import { useToast } from "@/components/ui/ToastProvider";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import dashboardStyles from "@/styles/Dashboard.module.css";
import styles from "./NotificationDiagnosticsPanel.module.css";

const EVENT_TYPES = [
  "",
  "new_inquiry",
  "buyer_replied",
  "agent_replied",
  "admin_replied",
  "viewing_requested",
  "viewing_confirmed",
  "viewing_declined",
  "viewing_rescheduled",
  "viewing_cancelled",
  "viewing_completed",
  "listing_approved",
  "listing_rejected",
  "listing_marked_sold",
  "listing_marked_rented",
  "listing_auto_archived",
  "agent_upgrade_submitted",
  "agent_upgrade_requested",
  "agent_upgrade_approved",
  "agent_upgrade_declined",
  "geographic_update_v1",
  "push_test",
];

const QUEUE_STATUSES = ["", "pending", "processing", "sent", "failed", "skipped"];
const PUSH_STATUSES = [
  "",
  "not_attempted",
  "in_progress",
  "delivered",
  "no_subscription",
  "temporary_failure",
  "failed",
];

function formatWhen(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusClassName(label) {
  const value = String(label || "").toLowerCase();
  if (value.includes("deliver")) return styles.statusDelivered;
  if (value.includes("fail")) return styles.statusFailed;
  if (value.includes("pending") || value.includes("progress")) return styles.statusPending;
  return styles.statusMuted;
}

function DetailSection({ title, items }) {
  return (
    <section className={styles.detailSection}>
      <h4>{title}</h4>
      <ul className={styles.detailList}>
        {items.map((item) => (
          <li key={item.label}>
            <span className={styles.detailLabel}>{item.label}</span>
            <span className={styles.detailValue}>{item.value ?? "—"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DiagnosticDetailModal({ row, onClose, onCopyTrace }) {
  if (!row) return null;

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-diagnostics-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h3 id="notification-diagnostics-detail-title" className={dashboardStyles.sectionTitle}>
              Notification trace
            </h3>
            <p className={dashboardStyles.muted} style={{ margin: "4px 0 0", fontSize: 12 }}>
              {row.eventType} · {formatWhen(row.timestamp)}
            </p>
          </div>
          <div className={styles.modalActions}>
            <button
              type="button"
              className={dashboardStyles.toggleButton}
              onClick={() => void onCopyTrace(row)}
            >
              Copy Diagnostic Trace
            </button>
            <button type="button" className={dashboardStyles.toggleButton} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <DetailSection
            title="Logical event"
            items={[
              { label: "Event type", value: row.eventType },
              { label: "Recipient", value: `${row.recipient.displayName} (${row.recipient.shortId || "—"})` },
              { label: "Recipient role", value: row.recipient.role },
              { label: "Sender role", value: row.sender.role },
              { label: "Sender name", value: row.sender.name },
              { label: "Created", value: formatWhen(row.timestamp) },
              { label: "Dedupe key", value: row.inbox.dedupeKey },
            ]}
          />

          <DetailSection
            title="Entity"
            items={[
              { label: "Conversation", value: row.entity.conversationId },
              { label: "Viewing", value: row.entity.viewingId },
              { label: "Listing", value: row.entity.listingId },
              { label: "Inquiry", value: row.entity.inquiryId },
              { label: "Message", value: row.entity.messageId },
            ]}
          />

          <DetailSection
            title="Queue"
            items={[
              { label: "Queue id", value: row.queueId },
              { label: "Status", value: row.queue.status },
              { label: "Queued at", value: formatWhen(row.queue.queuedAt) },
              { label: "Processed at", value: formatWhen(row.queue.processedAt) },
              { label: "Attempts", value: row.queue.attempts },
            ]}
          />

          <DetailSection
            title="Durable notification"
            items={[
              { label: "Notification id", value: row.notificationId },
              { label: "Inbox status", value: row.inbox.status },
              { label: "Created", value: formatWhen(row.inbox.createdAt) },
              { label: "Title", value: row.inbox.title },
              { label: "Body", value: row.inbox.body },
              { label: "Read at", value: formatWhen(row.inbox.readAt) },
            ]}
          />

          <DetailSection
            title="Push"
            items={[
              { label: "Push state", value: row.push.status },
              { label: "Attempted at", value: formatWhen(row.push.attemptedAt) },
              { label: "Delivered at", value: formatWhen(row.push.deliveredAt) },
              { label: "Delivered count", value: row.push.deliveredCount },
              { label: "Last reason", value: row.push.lastReason },
              {
                label: "Devices",
                value:
                  row.push.subscriptions?.length > 0
                    ? row.push.subscriptions.map((sub) => sub.label).join(", ")
                    : "—",
              },
            ]}
          />

          <DetailSection
            title="Navigation"
            items={[
              { label: "Canonical href", value: row.navigation.href },
              { label: "Destination", value: row.navigation.destination },
              { label: "Click/open tracking", value: row.navigation.clickTracked ? "Tracked" : "Not tracked" },
              { label: "Delivery mode", value: row.deliveryMode },
              { label: "Delivery latency", value: row.deliveryLatency || "—" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function NotificationDiagnosticsPanel() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [pagination, setPagination] = useState({ returned: 0, total: null });
  const [filters, setFilters] = useState({
    eventType: "",
    queueStatus: "",
    pushStatus: "",
    deliveryMode: "",
    search: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError("Sign in required.");
        setRows([]);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ limit: "50" });
      if (filters.eventType) params.set("eventType", filters.eventType);
      if (filters.queueStatus) params.set("queueStatus", filters.queueStatus);
      if (filters.pushStatus) params.set("pushStatus", filters.pushStatus);
      if (filters.deliveryMode) params.set("deliveryMode", filters.deliveryMode);
      if (filters.search.trim()) params.set("search", filters.search.trim());

      const response = await fetch(`/api/admin/notification-diagnostics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "Could not load notification diagnostics.");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setSummary(payload.summary || null);
      setUpdatedAt(payload.updated_at || new Date().toISOString());
      setPagination({
        returned: payload.pagination?.returned ?? (payload.rows?.length || 0),
        total: payload.pagination?.total ?? null,
      });
    } catch (loadError) {
      setError(loadError?.message || "Could not load notification diagnostics.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryChips = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Rows", value: summary.total },
      { label: "Push delivered", value: summary.pushDelivered },
      { label: "Pending", value: summary.pending },
      { label: "Failed", value: summary.failed },
      { label: "No subscription", value: summary.noSubscription },
      { label: "Cron recovered", value: summary.cronRecovered },
      { label: "In-app only", value: summary.inAppOnly },
    ];
  }, [summary]);

  const copyTrace = useCallback(
    async (row) => {
      const result = await copyDiagnosticTextToClipboard(formatNotificationDiagnosticTrace(row));
      if (result.ok) {
        showToast({ type: "success", message: "Diagnostic trace copied" });
        return;
      }
      showToast({
        type: "error",
        message: "Could not copy diagnostic trace. Try selecting and copying manually.",
      });
    },
    [showToast]
  );

  const copyCurrentDiagnostics = useCallback(async () => {
    const report = formatNotificationDiagnosticsReport({
      diagnostics: rows,
      filters,
      generatedAt: updatedAt || new Date().toISOString(),
      environment: "Production",
      recordsCopied: rows.length,
      totalAvailable: pagination.total,
    });
    const result = await copyDiagnosticTextToClipboard(report);
    if (result.ok) {
      showToast({ type: "success", message: "Diagnostics copied" });
      return;
    }
    showToast({
      type: "error",
      message: "Could not copy diagnostics. Try selecting and copying manually.",
    });
  }, [rows, filters, updatedAt, pagination.total, showToast]);

  return (
    <div className={styles.notificationPanel}>
      <div className={dashboardStyles.card}>
        <div className={styles.toolbar}>
          <div>
            <h3 className={dashboardStyles.sectionTitle}>Notification diagnostics</h3>
            <p className={dashboardStyles.muted} style={{ margin: "4px 0 0", fontSize: 12 }}>
              Read-only trace of queue → inbox → push → destination. Last 24 hours by default.
            </p>
          </div>
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={dashboardStyles.toggleButton}
              disabled={!rows.length}
              onClick={() => void copyCurrentDiagnostics()}
            >
              Copy Current Diagnostics
            </button>
            <button type="button" className={dashboardStyles.toggleButton} onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>

        {summaryChips.length ? (
          <div className={styles.summaryRow} style={{ marginTop: 12 }}>
            {summaryChips.map((chip) => (
              <span key={chip.label} className={styles.summaryChip}>
                {chip.label}: {chip.value}
              </span>
            ))}
          </div>
        ) : null}

        <div className={styles.filters} style={{ marginTop: 12 }}>
          <div className={styles.filterField}>
            <label htmlFor="diag-event-type">Event type</label>
            <select
              id="diag-event-type"
              value={filters.eventType}
              onChange={(event) => setFilters((current) => ({ ...current, eventType: event.target.value }))}
            >
              {EVENT_TYPES.map((value) => (
                <option key={value || "all-events"} value={value}>
                  {value || "All events"}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="diag-queue-status">Queue status</label>
            <select
              id="diag-queue-status"
              value={filters.queueStatus}
              onChange={(event) => setFilters((current) => ({ ...current, queueStatus: event.target.value }))}
            >
              {QUEUE_STATUSES.map((value) => (
                <option key={value || "all-queue"} value={value}>
                  {value || "All queue statuses"}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="diag-push-status">Push status</label>
            <select
              id="diag-push-status"
              value={filters.pushStatus}
              onChange={(event) => setFilters((current) => ({ ...current, pushStatus: event.target.value }))}
            >
              {PUSH_STATUSES.map((value) => (
                <option key={value || "all-push"} value={value}>
                  {value || "All push statuses"}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="diag-delivery-mode">Delivery mode</label>
            <select
              id="diag-delivery-mode"
              value={filters.deliveryMode}
              onChange={(event) => setFilters((current) => ({ ...current, deliveryMode: event.target.value }))}
            >
              <option value="">All delivery modes</option>
              {Object.values(DELIVERY_MODES).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterField}>
            <label htmlFor="diag-search">Search entity / dedupe</label>
            <input
              id="diag-search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="conversation, viewing, message, dedupe"
            />
          </div>
        </div>

        {updatedAt ? (
          <p className={dashboardStyles.muted} style={{ margin: "10px 0 0", fontSize: 11 }}>
            Updated {formatWhen(updatedAt)}
          </p>
        ) : null}
      </div>

      {loading ? <p className={dashboardStyles.muted}>Loading notification diagnostics…</p> : null}
      {error ? <p className={dashboardStyles.muted}>{error}</p> : null}

      {!loading && !error && !rows.length ? (
        <PremiumEmptyState
          variant="activity"
          title="No notification events in this window"
          hint="Try widening filters or trigger a test notification from the Profile tab."
        />
      ) : null}

      {!loading && !error && rows.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Recipient</th>
                <th>Entity</th>
                <th>Queue</th>
                <th>Inbox</th>
                <th>Push</th>
                <th>Mode</th>
                <th>Latency</th>
                <th>Destination</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.queueId || row.notificationId || row.id}>
                  <td>{formatWhen(row.timestamp)}</td>
                  <td>{row.eventType}</td>
                  <td>{row.recipient.displayName}</td>
                  <td>{row.entity.summary.label}</td>
                  <td>{row.queue.status || "—"}</td>
                  <td>{row.inbox.status}</td>
                  <td className={statusClassName(row.push.status)}>{row.push.status}</td>
                  <td>{row.deliveryMode}</td>
                  <td>{row.deliveryLatency || "—"}</td>
                  <td>{row.navigation.href || "—"}</td>
                  <td className={statusClassName(row.result)}>
                    <button type="button" className={styles.rowButton} onClick={() => setSelectedRow(row)}>
                      {row.result}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <DiagnosticDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onCopyTrace={copyTrace}
      />
    </div>
  );
}
