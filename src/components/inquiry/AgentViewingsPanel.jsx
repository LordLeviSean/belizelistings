import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
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
import { formatViewingSlotCompact } from "@/lib/crm/viewingConversationMessages";
import { openMessagingConversationForViewing } from "@/lib/crm/viewingMessaging";
import listStyles from "./AgentInquiryList.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

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

function viewingIdsMatch(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
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
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState("");
  const [highlightId, setHighlightId] = useState(initialViewingId);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("10:00");
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!initialViewingId) return;
    setHighlightId(initialViewingId);
  }, [initialViewingId]);

  useEffect(() => {
    if (!initialViewingId || !viewings?.length) return;
    const match = viewings.find((row) => viewingIdsMatch(row.id, initialViewingId));
    if (match) {
      setHighlightId(match.id);
    }
  }, [initialViewingId, viewings]);

  useEffect(() => {
    if (!highlightId || !viewings?.length) return;
    const frame = window.requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightId, viewings]);

  useViewingsRealtime({ userId: agentUserId, asAgent: true }, onRefresh);

  if (!viewings?.length) {
    if (initialViewingId) {
      return <div className={loadingStyles.hydratingPanel} aria-busy="true" aria-label="Loading viewing request" />;
    }
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

  const handleMessageBuyer = async (row) => {
    if (!agentUserId || !row?.requester_id) {
      showToast({
        type: "info",
        message: "This buyer has no account — use email if shown on the request.",
      });
      return;
    }
    setBusyId(row.id);
    const { data, error } = await openMessagingConversationForViewing(supabase, {
      viewing: row,
      agentUserId,
    });
    setBusyId("");
    if (error) {
      showToast({ type: "error", message: error.message || "Could not open inbox." });
      return;
    }
    const href = buildConversationHref({ surface, conversationId: data?.conversationId });
    if (href) {
      await router.push(href);
      return;
    }
    showToast({ type: "error", message: "Could not open inbox." });
  };

  return (
    <>
      <div className={listStyles.list} role="feed" aria-label="Viewings">
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
              ref={viewingIdsMatch(highlightId, row.id) ? highlightRef : undefined}
              className={[
                listStyles.card,
                highlightId === row.id ? listStyles.cardHighlighted : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <header className={listStyles.cardHead}>
                <span className={listStyles.channel}>Viewing appointment</span>
                <time className={listStyles.time} dateTime={row.requested_date}>
                  {formatViewingSlotCompact(row.requested_date, row.requested_time)}
                </time>
              </header>
              <dl className={listStyles.meta}>
                <div>
                  <dt>Property</dt>
                  <dd>{title}</dd>
                </div>
                <div>
                  <dt>Requested by</dt>
                  <dd>{requester}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{viewingStatusLabel(row.status)}</dd>
                </div>
              </dl>
              {buyerProposed ? (
                <p className={listStyles.body}>
                  Buyer proposed: {formatViewingSlotCompact(row.proposed_date, row.proposed_time)}
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
                {row.requester_id && agentUserId ? (
                  <button
                    type="button"
                    className={listStyles.secondary}
                    disabled={busyId === row.id}
                    onClick={() => void handleMessageBuyer(row)}
                  >
                    Message buyer
                  </button>
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
        title="Decline viewing?"
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
