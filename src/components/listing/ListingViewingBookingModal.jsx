import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { BL_ENABLE_TURNSTILE, BL_ENABLE_VIEWING_PERSIST, TURNSTILE_SITE_KEY } from "@/lib/featureFlags";
import {
  isInquiryEmailReadOnly,
  resolveInquirySenderEmail,
} from "@/lib/inquiryEmailPrefill";
import { resolveListingAgentUserId, resolveListingAgentUserIdAsync } from "@/lib/listingInquiryTargets";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import ListingInteractionModal from "./ListingInteractionModal";
import styles from "./ListingViewingBookingModal.module.css";

function buildTimeSlots() {
  const out = [];
  for (let mins = 7 * 60; mins <= 19 * 60; mins += 15) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    out.push({ value, label });
  }
  return out;
}

const TIME_SLOTS = buildTimeSlots();

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function isoParts(iso) {
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return { y, mo, d };
}

function toISODate(y, monthIndex, day) {
  return `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInCalendarMonth(y, monthIndex) {
  return new Date(y, monthIndex + 1, 0).getDate();
}

function formatDateLong(iso) {
  if (!iso) return "";
  const p = isoParts(iso);
  if (!p) return iso;
  const dt = new Date(p.y, p.mo - 1, p.d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatMonthYear(y, monthIndex) {
  return new Date(y, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function slotLabel(value) {
  return TIME_SLOTS.find((s) => s.value === value)?.label || value;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const dim = daysInCalendarMonth(year, monthIndex);
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ kind: "pad", key: `p-${i}` });
  for (let d = 1; d <= dim; d += 1) cells.push({ kind: "day", d, key: `d-${d}` });
  while (cells.length % 7 !== 0) cells.push({ kind: "pad", key: `t-${cells.length}` });
  return cells;
}

export default function ListingViewingBookingModal({
  open,
  onClose,
  listing,
  user: userProp,
  agentUserId: agentUserIdProp,
}) {
  const { showToast } = useToast();
  const { user: sessionUser, profile } = useUserRole();
  const user = userProp ?? sessionUser;

  const listingAgentUserId = useMemo(
    () => agentUserIdProp || resolveListingAgentUserId(listing),
    [agentUserIdProp, listing]
  );

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState(TIME_SLOTS[0]?.value ?? "07:00");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState("pick");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewYM, setViewYM] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });

  const isGuest = !user?.id;
  const emailReadOnly = isInquiryEmailReadOnly(user);
  const turnstileRequired = BL_ENABLE_TURNSTILE && isGuest && Boolean(TURNSTILE_SITE_KEY);

  const title = listing?.title ? String(listing.title) : "This listing";

  const minDate = useMemo(() => todayISODate(), []);
  const maxDate = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 90);
    return t.toISOString().slice(0, 10);
  }, []);

  const monthCells = useMemo(() => buildMonthCells(viewYM.y, viewYM.m), [viewYM.y, viewYM.m]);

  useEffect(() => {
    if (!open) return undefined;
    setSelectedDate(todayISODate());
    setSelectedTime(TIME_SLOTS[0]?.value ?? "07:00");
    setGuestEmail(resolveInquirySenderEmail(user, profile));
    setGuestName("");
    setMessage("");
    setTurnstileToken("");
    setPending(false);
    setConfirmed(false);
    setStep("pick");
    setCalendarOpen(false);
    const t = new Date();
    setViewYM({ y: t.getFullYear(), m: t.getMonth() });
  }, [open]);

  const openCalendar = useCallback(() => {
    const base = selectedDate && selectedDate >= minDate && selectedDate <= maxDate ? selectedDate : minDate;
    const p = isoParts(base);
    if (p) setViewYM({ y: p.y, m: p.mo - 1 });
    setCalendarOpen(true);
  }, [selectedDate, minDate, maxDate]);

  const bumpMonth = useCallback((delta) => {
    setViewYM(({ y, m }) => {
      let nm = m + delta;
      let ny = y;
      while (nm < 0) {
        nm += 12;
        ny -= 1;
      }
      while (nm > 11) {
        nm -= 12;
        ny += 1;
      }
      return { y: ny, m: nm };
    });
  }, []);

  const handleConfirmBooking = useCallback(async () => {
    if (pending || confirmed || !listing?.id) return;
    if (!selectedDate || !selectedTime) return;

    let agentUserId = listingAgentUserId;
    if (!agentUserId) {
      agentUserId = await resolveListingAgentUserIdAsync(supabase, listing);
    }
    if (!agentUserId) {
      showToast({
        type: "error",
        message: "We could not reach the listing agent right now. Try phone or email if shown.",
      });
      return;
    }

    const email = (user?.email || guestEmail || "").trim();
    if (isGuest && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      showToast({ type: "error", message: "Valid email required." });
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      showToast({ type: "error", message: "Complete the verification check below." });
      return;
    }

    if (!BL_ENABLE_VIEWING_PERSIST) {
      setPending(true);
      window.setTimeout(() => {
        setPending(false);
        setConfirmed(true);
      }, 720);
      return;
    }

    setPending(true);
    try {
      const { createViewingRequest } = await import("@/lib/crm/viewingMutations");
      const { error, unavailable, data } = await createViewingRequest(supabase, {
        listingId: listing.id,
        agentUserId,
        requesterId: user?.id ?? null,
        requesterEmail: email || null,
        requesterName: guestName.trim() || user?.user_metadata?.full_name || null,
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        listingTitle: listing.title || null,
        message: message.trim() || null,
      });
      if (error) {
        const msg = error.message || "";
        if (unavailable || /viewing_requests|relation|does not exist/i.test(msg)) {
          showToast({
            type: "info",
            message: "Viewing booking is rolling out — the agent will confirm separately when live.",
          });
        } else if (error.code === "self_viewing_not_allowed") {
          showToast({ type: "error", message: error.message || "You can't schedule a viewing on your own listing." });
        } else {
          showToast({ type: "error", message: msg || "Could not schedule viewing." });
        }
        return;
      }
      if (!data?.id) {
        showToast({
          type: "error",
          message: "Your viewing request could not be saved. Please try again.",
        });
        return;
      }
      setConfirmed(true);
    } finally {
      setPending(false);
    }
  }, [
    pending,
    confirmed,
    listing,
    listingAgentUserId,
    selectedDate,
    selectedTime,
    user,
    guestEmail,
    guestName,
    message,
    turnstileRequired,
    turnstileToken,
    isGuest,
    showToast,
  ]);

  const isDaySelectable = useCallback(
    (iso) => iso >= minDate && iso <= maxDate,
    [minDate, maxDate]
  );

  if (!open) return null;

  const modalTitle = confirmed ? "You’re set" : "Schedule a viewing";

  const pickFooter = (
    <>
      <button type="button" className={styles.ghostBtn} onClick={() => onClose?.()}>
        Cancel
      </button>
      <button
        type="button"
        className={styles.primaryBtn}
        disabled={!selectedDate || !selectedTime}
        onClick={() => setStep("review")}
      >
        Continue
      </button>
    </>
  );

  const reviewFooter = (
    <>
      <button type="button" className={styles.ghostBtn} onClick={() => setStep("pick")} disabled={pending}>
        Back
      </button>
      <button type="button" className={styles.primaryBtn} onClick={handleConfirmBooking} disabled={pending}>
        {pending ? (
          <span className={styles.pendingInner}>
            <span className={styles.pendingDot} />
            Confirming…
          </span>
        ) : (
          "Confirm viewing"
        )}
      </button>
    </>
  );

  const confirmedFooter = (
    <button type="button" className={styles.primaryBtn} onClick={() => onClose?.()}>
      Done
    </button>
  );

  let footer = null;
  if (!confirmed && step === "pick") footer = pickFooter;
  if (!confirmed && step === "review") footer = reviewFooter;
  if (confirmed) footer = confirmedFooter;

  return (
    <ListingInteractionModal
      isOpen={open}
      onClose={onClose}
      title={modalTitle}
      titleId="booking-modal-title"
      compact
      panelClassName={styles.bookingPanel}
      footer={footer}
      onEscape={() => {
        if (calendarOpen) {
          setCalendarOpen(false);
          return;
        }
        onClose?.();
      }}
    >
      {!confirmed && step === "pick" ? (
        <>
          <p className={styles.lede}>
            Choose a date and a 15-minute window between 7:00 AM and 7:00 PM (local).
            {BL_ENABLE_VIEWING_PERSIST
              ? " Your request is sent to the listing agent for confirmation."
              : " This is a preview flow — nothing is sent yet."}
          </p>
          <div className={styles.field}>
            <span className={styles.fieldLabel} id="booking-date-label">
              Date
            </span>
            <button
              type="button"
              className={styles.dateTrigger}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
              aria-labelledby="booking-date-label"
              onClick={() => (calendarOpen ? setCalendarOpen(false) : openCalendar())}
            >
              <span className={styles.dateTriggerText}>
                {selectedDate ? formatDateLong(selectedDate) : "Select a date"}
              </span>
              <ChevronDown size={18} strokeWidth={2} className={styles.dateTriggerChevron} aria-hidden />
            </button>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="booking-time-select">
              Time
            </label>
            <select
              id="booking-time-select"
              className={styles.timeSelect}
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {!confirmed && step === "review" ? (
        <>
          <p className={styles.lede}>Review your visit — you can adjust before confirming.</p>
          {isGuest ? (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="viewing-guest-email">
                  Email
                </label>
                <input
                  id="viewing-guest-email"
                  type="email"
                  className={styles.timeSelect}
                  value={guestEmail}
                  readOnly={emailReadOnly}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email for confirmation"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="viewing-guest-name">
                  Name (optional)
                </label>
                <input
                  id="viewing-guest-name"
                  type="text"
                  className={styles.timeSelect}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </>
          ) : null}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="viewing-message">
              Note (optional)
            </label>
            <textarea
              id="viewing-message"
              className={styles.timeSelect}
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything the agent should know before your visit"
            />
          </div>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLine}>
              <span className={styles.summaryKey}>Property</span>
              <span className={styles.summaryVal}>{title}</span>
            </p>
            <p className={styles.summaryLine}>
              <span className={styles.summaryKey}>Date</span>
              <span className={styles.summaryVal}>{formatDateLong(selectedDate)}</span>
            </p>
            <p className={styles.summaryLine}>
              <span className={styles.summaryKey}>Time</span>
              <span className={styles.summaryVal}>{slotLabel(selectedTime)}</span>
            </p>
          </div>
          {turnstileRequired ? (
            <div className={styles.field}>
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {confirmed ? (
        <>
          <div className={styles.successMark} aria-hidden>
            <Check className={styles.successIcon} strokeWidth={2.4} />
          </div>
          <p className={styles.confirmCopy}>
            Your viewing request for <strong>{formatDateLong(selectedDate)}</strong> at{" "}
            <strong>{slotLabel(selectedTime)}</strong>{" "}
            {BL_ENABLE_VIEWING_PERSIST
              ? "has been sent to the agent. They will confirm your slot shortly."
              : "is held locally. An agent will confirm separately when booking goes live."}
          </p>
        </>
      ) : null}

      {calendarOpen ? (
        <div
          className={styles.calendarLayer}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCalendarOpen(false);
          }}
        >
          <div
            className={styles.calendarPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Choose date"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.calHead}>
              <button type="button" className={styles.calNav} aria-label="Previous month" onClick={() => bumpMonth(-1)}>
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              </button>
              <p className={styles.calTitle}>{formatMonthYear(viewYM.y, viewYM.m)}</p>
              <button type="button" className={styles.calNav} aria-label="Next month" onClick={() => bumpMonth(1)}>
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <span key={d} className={styles.weekCell}>
                  {d}
                </span>
              ))}
            </div>
            <div className={styles.dayGrid}>
              {monthCells.map((cell) => {
                if (cell.kind === "pad") {
                  return <span key={cell.key} className={styles.dayPad} aria-hidden />;
                }
                const iso = toISODate(viewYM.y, viewYM.m, cell.d);
                const selectable = isDaySelectable(iso);
                const selected = selectedDate === iso;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={!selectable}
                    className={`${styles.dayPill} ${selected ? styles.dayPillSelected : ""} ${
                      !selectable ? styles.dayPillMuted : ""
                    }`}
                    onClick={() => {
                      if (!selectable) return;
                      setSelectedDate(iso);
                      setCalendarOpen(false);
                    }}
                  >
                    {cell.d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </ListingInteractionModal>
  );
}
