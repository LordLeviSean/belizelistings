import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { VIEWING_STATUS } from "@/lib/crm/crmConstants";
import { viewingStatusLabel, isActiveViewingStatus } from "@/lib/crm/viewingStatusLabels";
import { resolveDeepLinkedViewingId, viewingIdsMatch, isDeepLinkViewingPending } from "@/lib/crm/viewingDeepLink";
import {
  archiveViewing,
  cancelViewing,
  deleteViewing,
  proposeViewingReschedule,
  acceptViewingReschedule,
  rejectViewingReschedule,
} from "@/lib/crm/viewingMutations";
import { useViewingsRealtime } from "@/lib/crm/useViewingsRealtime";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import { resolveMessageConversationPath } from "@/lib/dashboardCrmRoutes";
import listStyles from "./AgentInquiryList.module.css";
import loadingStyles from "@/styles/UserDashboard.module.css";

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

function isActiveStatus(status) {
  return isActiveViewingStatus(status);
}

export default function BuyerViewingsPanel({
  viewings = [],
  listingsById = {},
  buyerUserId,
  onRefresh,
  initialViewingId = null,
  deepLinkResolveState = "idle",
  crmLoading = false,
}) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState("");
  const [highlightId, setHighlightId] = useState(initialViewingId);
  const [cancelTarget, setCancelTarget] = useState(null);
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
    const resolvedId = resolveDeepLinkedViewingId(viewings, initialViewingId);
    if (resolvedId != null) {
      setHighlightId(resolvedId);
    }
  }, [initialViewingId, viewings]);

  useEffect(() => {
    if (!highlightId || !viewings?.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightId, viewings]);

  useViewingsRealtime({ userId: buyerUserId, asAgent: false }, onRefresh);

  const awaitingDeepLink = isDeepLinkViewingPending({
    initialViewingId,
    viewings,
    resolveState: deepLinkResolveState,
    crmLoading,
  });

  if (awaitingDeepLink) {
    return (
      <div
        className={loadingStyles.hydratingPanel}
        aria-busy="true"
        aria-label="Loading viewing request"
      />
    );
  }

  if (!viewings?.length) {
    if (initialViewingId && deepLinkResolveState === "missing") {
      return (
        <p className={listStyles.body}>
          This viewing request is no longer available in your list.
        </p>
      );
    }
    if (initialViewingId) {
      return (
        <div
          className={loadingStyles.hydratingPanel}
          aria-busy="true"
          aria-label="Loading viewing request"
        />
      );
    }
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Browse listings", href: "/" }}
      />
    );
  }

  const handleCancel = async () => {
    if (!cancelTarget?.id || !buyerUserId) return;
    setBusyId(cancelTarget.id);
    const { error } = await cancelViewing(supabase, {
      viewingId: cancelTarget.id,
      actorUserId: buyerUserId,
      cancelledByAgent: false,
    });
    setBusyId("");
    setCancelTarget(null);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not cancel viewing." });
      return;
    }
    showToast({ type: "success", message: "Viewing cancelled." });
    onRefresh?.();
  };

  const handleReschedule = async (viewingId) => {
    if (!buyerUserId || !proposedDate || !proposedTime) return;
    setBusyId(viewingId);
    const { error } = await proposeViewingReschedule(supabase, {
      viewingId,
      actorUserId: buyerUserId,
      asAgent: false,
      proposedDate,
      proposedTime,
    });
    setBusyId("");
    setRescheduleId(null);
    if (error) {
      showToast({ type: "error", message: error.message || "Could not request reschedule." });
      return;
    }
    showToast({ type: "success", message: "Reschedule request sent to the agent." });
    onRefresh?.();
  };

  const handleAcceptReschedule = async (viewingId) => {
    if (!buyerUserId) return;
    setBusyId(viewingId);
    const { error } = await acceptViewingReschedule(supabase, {
      viewingId,
      actorUserId: buyerUserId,
      asAgent: false,
    });
    setBusyId("");
    if (error) {
      showToast({ type: "error", message: error.message || "Could not accept proposed time." });
      return;
    }
    showToast({ type: "success", message: "Viewing time confirmed." });
    onRefresh?.();
  };

  const handleArchive = async (viewingId) => {
    if (!buyerUserId) return;
    setBusyId(viewingId);
    const { error } = await archiveViewing(supabase, {
      viewingId,
      userId: buyerUserId,
      asAgent: false,
    });
    setBusyId("");
    if (error) {
      showToast({ type: "error", message: error.message || "Could not archive viewing." });
      return;
    }
    showToast({ type: "success", message: "Viewing archived." });
    onRefresh?.();
  };

  const handleDeleteViewing = async () => {
    if (!deleteTarget?.id || !buyerUserId) return;
    setBusyId(deleteTarget.id);
    const { error } = await deleteViewing(supabase, {
      viewingId: deleteTarget.id,
      userId: buyerUserId,
      asAgent: false,
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

  const handleDeclineProposedTime = async (viewingId) => {
    if (!buyerUserId) return;
    setBusyId(viewingId);
    const { error } = await rejectViewingReschedule(supabase, {
      viewingId,
      actorUserId: buyerUserId,
      asAgent: false,
    });
    setBusyId("");
    if (error) {
      showToast({ type: "error", message: error.message || "Could not decline proposed time." });
      return;
    }
    showToast({ type: "success", message: "Proposed time declined — the owner has been notified." });
    onRefresh?.();
  };

  return (
    <>
      <div className={listStyles.list} role="feed" aria-label="Viewings">
        {viewings.map((row) => {
          const title =
            listingsById?.[row.listing_id]?.title ||
            `Listing ${String(row.listing_id || "").slice(0, 8)}…`;
          const active = isActiveStatus(row.status);
          const showRescheduleForm = rescheduleId === row.id;
          const agentProposed =
            row.status === VIEWING_STATUS.RESCHEDULED &&
            row.proposed_date &&
            row.proposed_by === "agent";

          return (
            <article
              key={row.id}
              ref={viewingIdsMatch(highlightId, row.id) ? highlightRef : undefined}
              className={[
                listStyles.card,
                viewingIdsMatch(highlightId, row.id) ? listStyles.cardHighlighted : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <header className={listStyles.cardHead}>
                <span className={listStyles.channel}>Viewing</span>
                <time className={listStyles.time} dateTime={row.requested_date}>
                  {formatViewingSlot(row.requested_date, row.requested_time)}
                </time>
              </header>
              <p className={listStyles.listingRef}>{title}</p>
              {agentProposed ? (
                <p className={listStyles.body}>
                  Agent proposed: {formatViewingSlot(row.proposed_date, row.proposed_time)}
                </p>
              ) : null}
              {row.notes || row.message ? (
                <p className={listStyles.body}>{row.notes || row.message}</p>
              ) : null}
              {showRescheduleForm ? (
                <div className={listStyles.meta}>
                  <label className={listStyles.meta}>
                    <span className={listStyles.channel}>New date</span>
                    <input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label className={listStyles.meta}>
                    <span className={listStyles.channel}>New time</span>
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
                    href={resolveMessageConversationPath({
                      role: "user",
                      side: "buyer",
                      conversationId: row.conversation_id,
                    })}
                  >
                    Open conversation
                  </Link>
                ) : null}
                {active && buyerUserId ? (
                  <>
                    {agentProposed ? (
                      <>
                        <button
                          type="button"
                          className={listStyles.primary}
                          disabled={busyId === row.id}
                          onClick={() => void handleAcceptReschedule(row.id)}
                        >
                          Accept proposed time
                        </button>
                        <button
                          type="button"
                          className={listStyles.secondary}
                          disabled={busyId === row.id}
                          onClick={() => void handleDeclineProposedTime(row.id)}
                        >
                          Decline proposed time
                        </button>
                      </>
                    ) : null}
                    {showRescheduleForm ? (
                      <>
                        <button
                          type="button"
                          className={listStyles.primary}
                          disabled={busyId === row.id || !proposedDate}
                          onClick={() => void handleReschedule(row.id)}
                        >
                          Send request
                        </button>
                        <button
                          type="button"
                          className={listStyles.secondary}
                          onClick={() => setRescheduleId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
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
                        Request reschedule
                      </button>
                    )}
                    <button
                      type="button"
                      className={listStyles.secondary}
                      disabled={busyId === row.id}
                      onClick={() => setCancelTarget(row)}
                    >
                      Cancel viewing
                    </button>
                  </>
                ) : null}
                {!active && buyerUserId ? (
                  <button
                    type="button"
                    className={listStyles.secondary}
                    disabled={busyId === row.id}
                    onClick={() => void handleArchive(row.id)}
                  >
                    Archive
                  </button>
                ) : null}
                {buyerUserId ? (
                  <button
                    type="button"
                    className={listStyles.secondary}
                    disabled={busyId === row.id}
                    onClick={() => setDeleteTarget(row)}
                  >
                    Delete
                  </button>
                ) : null}
                <span className={listStyles.statusPill}>
                  {viewingStatusLabel(row.status, { buyerFacing: true })}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <DeleteConfirmationModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void handleCancel()}
        title="Cancel viewing?"
        warningText="The agent will be notified. You can request a new viewing later."
        confirmLabel="Cancel viewing"
        loading={Boolean(busyId && cancelTarget?.id === busyId)}
        requireTypeDelete={false}
      />

      <DeleteConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !busyId && setDeleteTarget(null)}
        onConfirm={() => void handleDeleteViewing()}
        title="Delete viewing permanently?"
        warningText="This can't be undone. The viewing will be removed from your account only — the owner's copy is unaffected."
        confirmLabel="Delete permanently"
        loading={Boolean(busyId && deleteTarget?.id === busyId)}
        requireTypeDelete={false}
      />
    </>
  );
}
