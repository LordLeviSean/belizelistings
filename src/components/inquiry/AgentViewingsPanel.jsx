import Link from "next/link";
import { useState } from "react";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { VIEWING_STATUS } from "@/lib/crm/crmConstants";
import {
  acceptViewingReschedule,
  archiveViewing,
  cancelViewing,
  confirmViewing,
  declineViewing,
  markViewingCompleted,
  proposeViewingReschedule,
} from "@/lib/crm/viewingMutations";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import listStyles from "./AgentInquiryList.module.css";

function statusLabel(status) {
  if (status === VIEWING_STATUS.CONFIRMED) return "Confirmed";
  if (status === VIEWING_STATUS.PENDING) return "Pending";
  if (status === VIEWING_STATUS.CANCELLED) return "Cancelled";
  if (status === VIEWING_STATUS.COMPLETED) return "Completed";
  if (status === VIEWING_STATUS.RESCHEDULED) return "Reschedule proposed";
  if (status === VIEWING_STATUS.DECLINED) return "Declined";
  return status || "Scheduled";
}

function formatViewingSlot(date, time) {
  if (!date) return "";
  const timeStr = time ? String(time).slice(0, 5) : "";
  const dt = new Date(`${date}T${timeStr || "12:00"}:00`);
  if (Number.isNaN(dt.getTime())) return `${date}${timeStr ? ` ${timeStr}` : ""}`;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: timeStr ? "numeric" : undefined,
    minute: timeStr ? "2-digit" : undefined,
  });
}

function isPendingLike(status) {
  return status === VIEWING_STATUS.PENDING || status === VIEWING_STATUS.RESCHEDULED;
}

export default function AgentViewingsPanel({
  viewings = [],
  listingsById = {},
  agentUserId,
  onRefresh,
}) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState("");
  const [declineTarget, setDeclineTarget] = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("10:00");

  if (!viewings?.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "View listings", href: "/dashboard/agent?tab=listings" }}
      />
    );
  }

  const runAction = async (viewingId, fn) => {
    setBusyId(viewingId);
    const { error } = await fn();
    setBusyId("");
    if (error) {
      showToast({ type: "error", message: error.message || "Action failed." });
      return false;
    }
    onRefresh?.();
    return true;
  };

  const handleDecline = async () => {
    if (!declineTarget?.id || !agentUserId) return;
    setBusyId(declineTarget.id);
    const { error } = await declineViewing(supabase, {
      viewingId: declineTarget.id,
      agentUserId,
    });
    setBusyId("");
    setDeclineTarget(null);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not decline viewing." });
      return;
    }
    showToast({ type: "success", message: "Viewing declined." });
    onRefresh?.();
  };

  const handleProposeReschedule = async (viewingId) => {
    if (!agentUserId || !proposedDate || !proposedTime) return;
    const ok = await runAction(viewingId, () =>
      proposeViewingReschedule(supabase, {
        viewingId,
        actorUserId: agentUserId,
        asAgent: true,
        proposedDate,
        proposedTime,
      })
    );
    if (ok) {
      setRescheduleId(null);
      showToast({ type: "success", message: "Reschedule proposal sent." });
    }
  };

  return (
    <>
      <div className={listStyles.list} role="feed" aria-label="Viewing requests">
        {viewings.map((row) => {
          const title =
            listingsById?.[row.listing_id]?.title ||
            `Listing ${String(row.listing_id || "").slice(0, 8)}…`;
          const requester =
            row.requester_name || row.requester_email || (row.requester_id ? "Registered buyer" : "Guest");
          const showRescheduleForm = rescheduleId === row.id;
          const buyerProposed =
            row.status === VIEWING_STATUS.RESCHEDULED && row.proposed_date && !showRescheduleForm;

          return (
            <article key={row.id} className={listStyles.card}>
              <header className={listStyles.cardHead}>
                <span className={listStyles.channel}>Viewing request</span>
                <time className={listStyles.time} dateTime={row.requested_date}>
                  {formatViewingSlot(row.requested_date, row.requested_time)}
                </time>
              </header>
              <p className={listStyles.listingRef}>{title}</p>
              <dl className={listStyles.meta}>
                <div>
                  <dt>Requester</dt>
                  <dd>{requester}</dd>
                </div>
              </dl>
              {buyerProposed ? (
                <p className={listStyles.body}>
                  Buyer proposed: {formatViewingSlot(row.proposed_date, row.proposed_time)}
                </p>
              ) : null}
              {showRescheduleForm ? (
                <div className={listStyles.meta}>
                  <label>
                    <span className={listStyles.channel}>Proposed date</span>
                    <input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label>
                    <span className={listStyles.channel}>Proposed time</span>
                    <input
                      type="time"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
              <div className={listStyles.actions}>
                {row.listing_id ? (
                  <Link className={listStyles.secondary} href={`/listing/${row.listing_id}`}>
                    View listing
                  </Link>
                ) : null}
                {row.status === VIEWING_STATUS.PENDING && agentUserId ? (
                  <>
                    <button
                      type="button"
                      className={listStyles.primary}
                      disabled={busyId === row.id}
                      onClick={() =>
                        void runAction(row.id, () =>
                          confirmViewing(supabase, { viewingId: row.id, agentUserId })
                        ).then((ok) => ok && showToast({ type: "success", message: "Viewing confirmed." }))
                      }
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className={listStyles.secondary}
                      disabled={busyId === row.id}
                      onClick={() => setDeclineTarget(row)}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className={listStyles.secondary}
                      disabled={busyId === row.id}
                      onClick={() => {
                        setRescheduleId(row.id);
                        setProposedDate(row.requested_date || "");
                        setProposedTime(String(row.requested_time || "10:00").slice(0, 5));
                      }}
                    >
                      Propose new time
                    </button>
                  </>
                ) : null}
                {row.status === VIEWING_STATUS.RESCHEDULED && agentUserId && buyerProposed ? (
                  <>
                    <button
                      type="button"
                      className={listStyles.primary}
                      disabled={busyId === row.id}
                      onClick={() =>
                        void runAction(row.id, () =>
                          acceptViewingReschedule(supabase, { viewingId: row.id, agentUserId })
                        ).then((ok) => ok && showToast({ type: "success", message: "Reschedule accepted." }))
                      }
                    >
                      Accept proposed time
                    </button>
                    <button
                      type="button"
                      className={listStyles.secondary}
                      disabled={busyId === row.id}
                      onClick={() => setDeclineTarget(row)}
                    >
                      Decline
                    </button>
                  </>
                ) : null}
                {showRescheduleForm ? (
                  <>
                    <button
                      type="button"
                      className={listStyles.primary}
                      disabled={busyId === row.id || !proposedDate}
                      onClick={() => void handleProposeReschedule(row.id)}
                    >
                      Send proposal
                    </button>
                    <button type="button" className={listStyles.secondary} onClick={() => setRescheduleId(null)}>
                      Cancel
                    </button>
                  </>
                ) : null}
                {row.status === VIEWING_STATUS.CONFIRMED && agentUserId ? (
                  <>
                    <button
                      type="button"
                      className={listStyles.primary}
                      disabled={busyId === row.id}
                      onClick={() =>
                        void runAction(row.id, () =>
                          markViewingCompleted(supabase, { viewingId: row.id, agentUserId })
                        ).then((ok) => ok && showToast({ type: "success", message: "Marked completed." }))
                      }
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      className={listStyles.secondary}
                      disabled={busyId === row.id}
                      onClick={() =>
                        void runAction(row.id, () =>
                          cancelViewing(supabase, {
                            viewingId: row.id,
                            actorUserId: agentUserId,
                            cancelledByAgent: true,
                          })
                        ).then((ok) => ok && showToast({ type: "success", message: "Viewing cancelled." }))
                      }
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
                {(row.status === VIEWING_STATUS.COMPLETED ||
                  row.status === VIEWING_STATUS.CANCELLED ||
                  row.status === VIEWING_STATUS.DECLINED) &&
                agentUserId ? (
                  <button
                    type="button"
                    className={listStyles.secondary}
                    disabled={busyId === row.id}
                    onClick={() =>
                      void runAction(row.id, () =>
                        archiveViewing(supabase, { viewingId: row.id, userId: agentUserId, asAgent: true })
                      ).then((ok) => ok && showToast({ type: "success", message: "Archived." }))
                    }
                  >
                    Archive
                  </button>
                ) : null}
                <span className={listStyles.statusPill}>{statusLabel(row.status)}</span>
              </div>
            </article>
          );
        })}
      </div>

      <DeleteConfirmationModal
        isOpen={Boolean(declineTarget)}
        onClose={() => setDeclineTarget(null)}
        onConfirm={() => void handleDecline()}
        title="Decline viewing request?"
        warningText="The buyer will be notified. This cannot be undone."
        confirmLabel="Decline"
        loading={Boolean(busyId && declineTarget?.id === busyId)}
        requireTypeDelete={false}
      />
    </>
  );
}
