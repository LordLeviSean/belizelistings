import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { Turnstile } from "@marsidev/react-turnstile";
import { INQUIRY_CHANNEL, scoreInquiryBody } from "@/constants/inquiryModel";
import { BL_ENABLE_CONVERSATIONS, BL_ENABLE_TURNSTILE, TURNSTILE_SITE_KEY } from "@/lib/featureFlags";
import {
  isInquiryEmailReadOnly,
  resolveInquirySenderEmail,
} from "@/lib/inquiryEmailPrefill";
import { submitListingInquiry } from "@/lib/listingInquiries";
import { resolvePostInquiryMessagesPath } from "@/lib/dashboardCrmRoutes";
import { resolveListingAgentUserId, resolveListingAgentUserIdAsync } from "@/lib/listingInquiryTargets";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { useToast } from "@/components/ui/ToastProvider";
import ListingInteractionModal from "./ListingInteractionModal";
import styles from "./ListingMessageModal.module.css";

const MESSAGE_FORM_ID = "listing-message-form";

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
    if (open) return undefined;
    setSending(false);
    setTurnstileToken("");
    setCompanyWebsite("");
    return undefined;
  }, [open]);

  const emailHelper = emailReadOnly
    ? "This email will only be shared with the listing agent for this conversation."
    : "We'll share this only with the listing agent.";

  const emailPlaceholder = emailReadOnly
    ? ""
    : "Enter the email you'd like the agent to reply to";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id || sending) return;

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
        agentUserId,
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

      const inquiryId = data?.id ?? data?.inquiry_id ?? null;
      const conversationId = data?.conversationId ?? data?.conversation_id ?? null;
      if (!inquiryId && !conversationId) {
        showToast({
          type: "error",
          message: "Your message could not be saved. Please try again or use phone or email.",
        });
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

      if (user?.id && BL_ENABLE_CONVERSATIONS && conversationId) {
        void router.push(resolvePostInquiryMessagesPath({ role, conversationId }));
      }
    } finally {
      setSending(false);
    }
  };

  const footer = (
    <button
      type="submit"
      form={MESSAGE_FORM_ID}
      className={styles.submit}
      disabled={sending}
    >
      {sending ? "Sending…" : "Send message"}
    </button>
  );

  return (
    <ListingInteractionModal
      isOpen={open}
      onClose={onClose}
      title="Message the agent"
      titleId="msg-modal-title"
      footer={footer}
    >
      <p className={styles.lede}>
        Your message will be delivered securely through BelizeListings.
      </p>

      <form id={MESSAGE_FORM_ID} className={styles.form} onSubmit={handleSubmit}>
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
      </form>
    </ListingInteractionModal>
  );
}
