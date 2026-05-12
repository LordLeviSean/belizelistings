import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { INQUIRY_CHANNEL, scoreInquiryBody } from "@/constants/inquiryModel";
import { submitListingInquiry } from "@/lib/listingInquiries";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingMessageModal.module.css";

export default function ListingMessageModal({ open, onClose, listing, user }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
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
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id || !listing?.user_id || sending) return;
    const gate = scoreInquiryBody(body);
    if (!gate.ok) {
      showToast({ type: "error", message: gate.reason || "Add a bit more detail." });
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast({ type: "error", message: "Valid email required." });
      return;
    }

    setSending(true);
    try {
      const { error } = await submitListingInquiry(supabase, {
        listingId: listing.id,
        agentUserId: listing.user_id,
        senderUserId: user?.id ?? null,
        senderName: null,
        senderEmail: email.trim(),
        senderPhone: null,
        channel: INQUIRY_CHANNEL.CONTACT,
        body: body.trim(),
        qualityScore: gate.score ?? null,
      });
      if (error) {
        const msg = error.message || "";
        if (/listing_inquiries|relation|does not exist/i.test(msg)) {
          showToast({
            type: "info",
            message: "Messaging is rolling out — try WhatsApp or phone if shown on the listing.",
          });
        } else {
          showToast({ type: "error", message: msg || "Could not send." });
        }
        return;
      }
      showToast({ type: "success", message: "Message sent to the agent." });
      setBody("");
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
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="msg-modal-title"
      >
        <div className={styles.head}>
          <h2 id="msg-modal-title" className={styles.title}>
            Message the agent
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => onClose?.()}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className={styles.lede}>Brief and professional — your email is shared with the listing agent only.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              required
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className={styles.label}>
            Message
            <textarea
              required
              className={styles.textarea}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Introduce yourself and what you’re exploring…"
            />
          </label>
          <button type="submit" className={styles.submit} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
