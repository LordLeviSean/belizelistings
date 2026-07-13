import Link from "next/link";
import { useEffect, useState } from "react";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { VIEWING_STATUS } from "@/lib/crm/crmConstants";
import { viewingStatusLabel, isOwnerActionableViewingStatus } from "@/lib/crm/viewingStatusLabels";
import {
  acceptViewingReschedule,
  archiveViewing,
  cancelViewing,
  confirmViewing,
  declineViewing,
  deleteViewing,
  markViewingCompleted,
  proposeViewingReschedule,
} from "@/lib/crm/viewingMutations";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import { useViewingsRealtime } from "@/lib/crm/useViewingsRealtime";
import { resolveMessageConversationPath } from "@/lib/dashboardCrmRoutes";
import listStyles from "./AgentInquiryList.module.css";

function buildConversationHref({ surface = "agent", conversationId }) {
  if (!conversationId) return null;
  if (surface === "admin") {
    return resolveMessageConversationPath({ role: "admin", side: "owner", conversationId });
  }
  if (surface === "user") {
    return resolveMessageConversationPath({ role: "user", side: "owner", conversationId });
  }
  return resolveMessageConversationPath({ role: "agent", side: "agent", conversationId });
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
  return isOwnerActionableViewingStatus(status);
}

export default function AgentViewingsPanel({
  viewings = [],
  listingsById = {},
  agentUserId,
  onRefresh,
  initialViewingId = null,
  surface = "agent",
}) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState("");
  const [highlightId, setHighlightId] = useState(initialViewingId);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("10:00");

  useEffect(() => {
    if (!initialViewingId) return;
    setHighlightId(initialViewingId);
  }, [initialViewingId]);

  useViewingsRealtime({ userId: agentUserId, asAgent: true }, onRefresh);

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

  const handleDeleteViewing = async () => {
    if (!deleteTarget?.id || !agentUserId) return;
    setBusyId(deleteTarget.id);
    const { error } = await deleteViewing(supabase, {
      viewingId: deleteTarget.id,
      userId: agentUserId,
      asAgent: true,
    });
    setBusyId("");
    setDeleteTarget(null);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not delete viewing." });
      return;
    }
    showToast({ type: "success", message: "Viewing permanently removed from your list." });
    onRefresh?.();
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
            row.status === VIEWING_STATUS.RESCHEDULED &&
            row.proposed_date &&
            row.proposed_by === "buyer";

          return (
            <article
              key={row.id}
              className={[
                listStyles.card,
                highlightId === row.id ? listStyles.cardHighlighted : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
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
                {row.conversation_id ? (
                  <Link
                    className={listStyles.secondary}
                    href={buildConversationHref({ surface, conversationId: row.conversation_id })}
                  >
                    Open conversation
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
                          acceptViewingReschedule(supabase, {
                            viewingId: row.id,
                            actorUserId: agentUserId,
                            asAgent: true,
                          })
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
                {agentUserId ? (
                  <button
                    type="button"
                    className={listStyles.secondary}
                    disabled={busyId === row.id}
                    onClick={() => setDeleteTarget(row)}
                  >
                    Delete
                  </button>
                ) : null}
                <span className={listStyles.statusPill}>{viewingStatusLabel(row.status)}</span>
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

      <DeleteConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !busyId && setDeleteTarget(null)}
        onConfirm={() => void handleDeleteViewing()}
        title="Delete viewing permanently?"
        warningText="This can't be undone. The viewing will be removed from your account only — the buyer's copy is unaffected."
        confirmLabel="Delete permanently"
        loading={Boolean(busyId && deleteTarget?.id === busyId)}
        requireTypeDelete={false}
      />
    </>
  );
}
