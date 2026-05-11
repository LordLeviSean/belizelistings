import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { INQUIRY_CHANNEL, scoreInquiryBody } from "@/constants/inquiryModel";
import { submitListingInquiry } from "@/lib/listingInquiries";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingViewingModal.module.css";

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

function formatDateLocal(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function ListingViewingModal({ open, onClose, listing, user }) {
  const { showToast } = useToast();
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[4]);
  const [note, setNote] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sending, setSending] = useState(false);

  const timezoneLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
    } catch {
      return "";
    }
  }, []);

  const minDate = useMemo(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  }, []);

  const maxDate = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 56);
    return t.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSending(false);
      return undefined;
    }
    setContactEmail(user?.email || "");
    setDate((d) => d || minDate);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, minDate, user?.email]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id || !listing?.user_id || sending) return;
    if (!date || !timeSlot) {
      showToast({ type: "error", message: "Choose a date and time." });
      return;
    }
    const emailTrim = contactEmail.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      showToast({ type: "error", message: "Enter a valid email so the agent can confirm." });
      return;
    }

    const datePretty = formatDateLocal(date);
    const body = [
      `Viewing request for "${listing?.title || "listing"}".`,
      `Preferred: ${datePretty} at ${timeSlot}`,
      timezoneLabel ? `Timezone: ${timezoneLabel} (local)` : "",
      note.trim() ? `Note: ${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const gate = scoreInquiryBody(body);
    if (!gate.ok) {
      showToast({ type: "error", message: gate.reason || "Could not send request." });
      return;
    }

    setSending(true);
    try {
      const { error } = await submitListingInquiry(supabase, {
        listingId: listing.id,
        agentUserId: listing.user_id,
        senderUserId: user?.id ?? null,
        senderName: null,
        senderEmail: emailTrim,
        senderPhone: null,
        channel: INQUIRY_CHANNEL.VIEWING,
        body,
        qualityScore: gate.score ?? null,
      });
      if (error) {
        const msg = error.message || "";
        if (/listing_inquiries|relation|does not exist/i.test(msg)) {
          showToast({
            type: "info",
            message: "Scheduling is finishing rollout — contact the agent directly for now.",
          });
        } else {
          showToast({ type: "error", message: msg || "Could not submit." });
        }
        return;
      }
      showToast({ type: "success", message: "Viewing request sent. The agent will follow up." });
      setNote("");
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="view-modal-title">
        <div className={styles.head}>
          <h2 id="view-modal-title" className={styles.title}>
            Schedule a viewing
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => onClose?.()}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={styles.lede}>
          Pick a preferred window — {timezoneLabel ? `times are local (${timezoneLabel}).` : "times are local."}
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Your email
            <input
              type="email"
              required
              className={styles.input}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className={styles.label}>
            Date
            <input
              type="date"
              required
              className={styles.input}
              min={minDate}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className={styles.label}>
            Time
            <select className={styles.select} value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Short note <span className={styles.optional}>(optional)</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Access, parking, or timing preferences…"
            />
          </label>
          <button type="submit" className={styles.submit} disabled={sending}>
            {sending ? "Sending…" : "Request viewing"}
          </button>
        </form>
      </div>
    </div>
  );
}
