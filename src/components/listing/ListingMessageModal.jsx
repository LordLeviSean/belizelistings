import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { Turnstile } from "@marsidev/react-turnstile";
import { X } from "lucide-react";
import { INQUIRY_CHANNEL, scoreInquiryBody } from "@/constants/inquiryModel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_TURNSTILE, TURNSTILE_SITE_KEY } from "@/lib/featureFlags";
import {
  isInquiryEmailReadOnly,
  resolveInquirySenderEmail,
} from "@/lib/inquiryEmailPrefill";
import { submitListingInquiry } from "@/lib/listingInquiries";
import { resolvePostInquiryMessagesPath } from "@/lib/dashboardCrmRoutes";
import { resolveListingAgentUserId } from "@/lib/listingInquiryTargets";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingMessageModal.module.css";

const MESSAGE_PLACEHOLDER =
  "Introduce yourself, ask a question about the property, request a viewing, or inquire about pricing...";

export default function ListingMessageModal({ open, onClose, listing, user: userProp, agentUserId: agentUserIdProp }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user: sessionUser, profile, role } = useUserRole();
  const user = userProp ?? sessionUser;

  const listingAgentUserId = useMemo(
    () => agentUserIdProp || resolveListingAgentUserId(listing),
    [agentUserIdProp, listing]
  );

  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sending, setSending] = useState(false);
  const turnstileRef = useRef(null);

  const isGuest = !user?.id;
  const emailReadOnly = isInquiryEmailReadOnly(user);
  const turnstileRequired = BL_ENABLE_TURNSTILE && isGuest && Boolean(TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (!open) return;
    setEmail(resolveInquirySenderEmail(user, profile));
  }, [open, user, profile]);

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
      return undefined;
    }
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  if (!open) return null;

  const emailHelper = emailReadOnly
    ? "This email will only be shared with the listing agent for this conversation."
    : "We'll share this only with the listing agent.";

  const emailPlaceholder = emailReadOnly
    ? ""
    : "Enter the email you'd like the agent to reply to";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id || !listingAgentUserId || sending) return;
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
      const { data, error } = await submitListingInquiry(supabase, {
        listingId: listing.id,
        agentUserId: listingAgentUserId,
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

      showToast({
        type: "success",
        message: "Your message has been delivered to the listing agent.",
      });
      setBody("");
      setTurnstileToken("");
      turnstileRef.current?.reset();
      onClose?.();

      const conversationId = data?.conversationId ?? data?.conversation_id ?? null;
      if (user?.id && BL_ENABLE_CONVERSATIONS && conversationId) {
        void router.push(resolvePostInquiryMessagesPath({ role, conversationId }));
      }
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

        <p className={styles.lede}>
          Your message will be delivered securely through BelizeListings.
        </p>

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
            Your Email Address
            <input
              type="email"
              required
              readOnly={emailReadOnly}
              className={`${styles.input}${emailReadOnly ? ` ${styles.inputReadOnly}` : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={emailPlaceholder}
            />
            <span className={styles.helper}>{emailHelper}</span>
          </label>

          <label className={styles.label}>
            Message
            <textarea
              required
              className={styles.textarea}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={MESSAGE_PLACEHOLDER}
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
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </div>
  );
}
