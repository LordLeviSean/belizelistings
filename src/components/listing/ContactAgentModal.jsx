import { useEffect, useMemo } from "react";
import { Mail, MessageCircle, X } from "lucide-react";
import styles from "./ContactAgentModal.module.css";

function digitsOnly(s = "") {
  return String(s || "").replace(/\D/g, "");
}

function looksLikeEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function ContactAgentModal({ open, onClose, listing, onOpenSiteMessage }) {
  const listingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/listing/${listing?.id}` : "";

  const waDigits = digitsOnly(listing?.agent_phone || "");
  const hasWhatsApp = waDigits.length >= 7;
  const waHref = hasWhatsApp
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Hi — I'm interested in "${listing?.title || "this listing"}" on BelizeListings.\n${listingUrl}`
      )}`
    : "";

  const agentEmail = String(listing?.agent_email || "").trim();
  const hasEmail = looksLikeEmail(agentEmail);
  const mailHref = hasEmail ? `mailto:${agentEmail}?subject=${encodeURIComponent(`Listing: ${listing?.title || ""}`)}&body=${encodeURIComponent(`Hi,\n\nI'm interested in this property on BelizeListings:\n${listingUrl}\n`)}` : "";

  const displayName = useMemo(() => {
    const n = listing?.agent_name || listing?.agent;
    if (n && String(n).trim()) return String(n).trim();
    return "Your listing agent";
  }, [listing?.agent_name, listing?.agent]);

  const brokerage = listing?.agency_name || listing?.brokerage_name;
  const brokerageLabel = brokerage && String(brokerage).trim() ? String(brokerage).trim() : "";

  const initial = useMemo(() => {
    const ch = displayName.charAt(0);
    return /[a-zA-Z0-9]/.test(ch) ? ch.toUpperCase() : "?";
  }, [displayName]);

  useEffect(() => {
    if (!open) return undefined;
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

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contact-agent-title">
        <div className={styles.head}>
          <h2 id="contact-agent-title" className={styles.title}>
            Contact agent
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => onClose?.()}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.hero}>
          <div className={styles.avatar} aria-hidden>
            {initial}
          </div>
          <div className={styles.heroText}>
            <p className={styles.agentName}>{displayName}</p>
            {brokerageLabel ? <p className={styles.brokerage}>{brokerageLabel}</p> : null}
          </div>
        </div>

        <p className={styles.lede}>
          Choose how you would like to reach out. For a richer note or attachments, use the BelizeListings inbox below.
        </p>

        <div className={styles.pathGrid}>
          {hasWhatsApp ? (
            <a
              href={waHref}
              className={styles.pathCard}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClose?.()}
            >
              <span className={styles.pathIcon} aria-hidden>
                <MessageCircle size={22} strokeWidth={2} />
              </span>
              <span className={styles.pathLabel}>WhatsApp</span>
              <span className={styles.pathHint}>Message the agent directly</span>
            </a>
          ) : (
            <div className={`${styles.pathCard} ${styles.pathCardDisabled}`} aria-disabled="true">
              <span className={styles.pathIcon} aria-hidden>
                <MessageCircle size={22} strokeWidth={2} />
              </span>
              <span className={styles.pathLabel}>WhatsApp</span>
              <span className={styles.pathHintMuted}>No phone on file for this listing yet.</span>
            </div>
          )}

          {hasEmail ? (
            <a href={mailHref} className={styles.pathCard} onClick={() => onClose?.()}>
              <span className={styles.pathIcon} aria-hidden>
                <Mail size={22} strokeWidth={2} />
              </span>
              <span className={styles.pathLabel}>Email</span>
              <span className={styles.pathHint}>Open your mail app to compose</span>
            </a>
          ) : (
            <div className={`${styles.pathCard} ${styles.pathCardDisabled}`} aria-disabled="true">
              <span className={styles.pathIcon} aria-hidden>
                <Mail size={22} strokeWidth={2} />
              </span>
              <span className={styles.pathLabel}>Email</span>
              <span className={styles.pathHintMuted}>Agent email is not published on this listing.</span>
            </div>
          )}
        </div>

        {typeof onOpenSiteMessage === "function" ? (
          <p className={styles.inboxRow}>
            <button type="button" className={styles.inboxLink} onClick={() => onOpenSiteMessage()}>
              Send a note through BelizeListings
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
