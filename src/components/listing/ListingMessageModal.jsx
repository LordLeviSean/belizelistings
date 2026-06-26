import { useEffect, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { X } from "lucide-react";
import { INQUIRY_CHANNEL, scoreInquiryBody } from "@/constants/inquiryModel";
import { BL_ENABLE_TURNSTILE, TURNSTILE_SITE_KEY } from "@/lib/featureFlags";
import { submitListingInquiry } from "@/lib/listingInquiries";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingMessageModal.module.css";

export default function ListingMessageModal({ open, onClose, listing, user }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sending, setSending] = useState(false);
  const turnstileRef = useRef(null);
  const isGuest = !user?.id;
  const turnstileRequired = BL_ENABLE_TURNSTILE && isGuest && Boolean(TURNSTILE_SITE_KEY);
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
      setTurnstileToken("");
      setCompanyWebsite("");
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
    if (turnstileRequired && !turnstileToken) {
      showToast({ type: "error", message: "Complete the verification check below." });
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
        turnstileToken: turnstileRequired ? turnstileToken : null,
        company_website: companyWebsite,
      });
      if (error) {
        const msg = error.message || "";
        if (error.code === "rate_limited_listing" || error.code === "rate_limited_global") {
          showToast({ type: "error", message: msg || "Too many messages. Try again later." });
        } else if (/listing_inquiries|relation|does not exist/i.test(msg)) {
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
      setTurnstileToken("");
      turnstileRef.current?.reset();
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
          <label className={styles.honeypot} aria-hidden="true">
            Company website
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
            />
          </label>
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
          {turnstileRequired ? (
            <div className={styles.turnstileWrap}>
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                options={{ theme: "light", size: "normal" }}
              />
            </div>
          ) : null}
          <button type="submit" className={styles.submit} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
