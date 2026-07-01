import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, MessageCircle, Phone, X } from "lucide-react";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import {
  copyTextToClipboard,
  isMobileContactDevice,
  MOBILE_CONTACT_MQ,
} from "@/lib/deviceDetection";
import {
  resolveListingContact,
  resolveListingContactFromListingFields,
} from "@/lib/listingContactResolver";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ContactAgentModal.module.css";

function digitsOnly(s = "") {
  return String(s || "").replace(/\D/g, "");
}

function looksLikeEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function formatPhoneDisplay(digits) {
  if (!digits) return "";
  return String(digits).replace(/^(\d{3})(\d{3})(\d+)$/, "+$1 $2 $3").replace(/^\+?(\d)/, "+$1");
}

export default function ContactAgentModal({
  open,
  onClose,
  listing,
  contact: contactProp,
  onOpenSiteMessage,
}) {
  const { showToast } = useToast();
  const [isMobile, setIsMobile] = useState(false);

  const listingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/listing/${listing?.id}` : "";

  const contact = useMemo(() => {
    if (contactProp) return contactProp;
    return (
      resolveListingContact(listing, null) ||
      resolveListingContactFromListingFields(listing) ||
      null
    );
  }, [contactProp, listing]);

  const displayName = contact?.displayName || "Your listing agent";
  const brokerageLabel = contact?.brokerageName || "";

  const phoneRaw = contact?.showPhonePublic !== false ? String(contact?.phone || "").trim() : "";
  const phoneDigits = digitsOnly(phoneRaw);
  const hasPhone = phoneDigits.length >= 7;
  const phoneDisplay = phoneRaw || (hasPhone ? formatPhoneDisplay(phoneDigits) : "");
  const phoneHref = hasPhone ? `tel:+${phoneDigits.replace(/^0+/, "")}` : "";

  const waRaw =
    contact?.showPhonePublic !== false
      ? String(contact?.whatsapp || contact?.phone || "").trim()
      : "";
  const waDigits = digitsOnly(waRaw);
  const hasWhatsApp = waDigits.length >= 7;
  const waDisplay = waRaw || (hasWhatsApp ? formatPhoneDisplay(waDigits) : "");
  const waHref = hasWhatsApp
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Hi — I'm interested in "${listing?.title || "this listing"}" on BelizeListings.\n${listingUrl}`
      )}`
    : "";

  const agentEmail =
    contact?.showEmailPublic !== false ? String(contact?.email || "").trim() : "";
  const hasEmail = looksLikeEmail(agentEmail);
  const mailHref = hasEmail
    ? `mailto:${agentEmail}?subject=${encodeURIComponent(`Listing: ${listing?.title || ""}`)}&body=${encodeURIComponent(`Hi,\n\nI'm interested in this property on BelizeListings:\n${listingUrl}\n`)}`
    : "";

  const initial = useMemo(() => {
    const ch = displayName.charAt(0);
    return /[a-zA-Z0-9]/.test(ch) ? ch.toUpperCase() : "?";
  }, [displayName]);

  const canMessageViaSite = BL_ENABLE_CONVERSATIONS && typeof onOpenSiteMessage === "function";

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setIsMobile(isMobileContactDevice());
    const mq = window.matchMedia(MOBILE_CONTACT_MQ);
    const onChange = () => setIsMobile(isMobileContactDevice());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const handleCopy = async (label, value) => {
    const ok = await copyTextToClipboard(value);
    showToast({
      type: ok ? "success" : "info",
      message: ok ? `${label} copied` : `Could not copy ${label.toLowerCase()}.`,
    });
  };

  if (!open) return null;

  const renderContactRow = ({ icon: Icon, label, value, href, disabledHint, showWaWeb }) => {
    if (!value && !disabledHint) return null;

    if (!value) {
      return (
        <div className={`${styles.contactRow} ${styles.contactRowDisabled}`} aria-disabled="true">
          <span className={styles.contactIcon} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className={styles.contactMeta}>
            <span className={styles.contactLabel}>{label}</span>
            <span className={styles.contactHintMuted}>{disabledHint}</span>
          </span>
        </div>
      );
    }

    if (isMobile && href) {
      return (
        <a href={href} className={styles.contactRow} onClick={() => onClose?.()} target={showWaWeb ? "_blank" : undefined} rel={showWaWeb ? "noopener noreferrer" : undefined}>
          <span className={styles.contactIcon} aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
          <span className={styles.contactMeta}>
            <span className={styles.contactLabel}>{label}</span>
            <span className={styles.contactValue}>{value}</span>
          </span>
        </a>
      );
    }

    return (
      <div className={styles.contactRow}>
        <span className={styles.contactIcon} aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <span className={styles.contactMeta}>
          <span className={styles.contactLabel}>{label}</span>
          <span className={styles.contactValue}>{value}</span>
        </span>
        <div className={styles.contactActions}>
          <button
            type="button"
            className={styles.copyBtn}
            aria-label={`Copy ${label}`}
            onClick={() => void handleCopy(label, value)}
          >
            <Copy size={14} aria-hidden />
            Copy
          </button>
          {showWaWeb && href ? (
            <a
              href={href}
              className={styles.waWebLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClose?.()}
            >
              Open WhatsApp Web
            </a>
          ) : null}
        </div>
      </div>
    );
  };

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

        <div className={styles.contactCard} aria-label="Agent contact details">
          {renderContactRow({
            icon: Phone,
            label: "Phone",
            value: phoneDisplay,
            href: phoneHref,
            disabledHint: "Phone is not published for this listing.",
          })}
          {renderContactRow({
            icon: MessageCircle,
            label: "WhatsApp",
            value: waDisplay,
            href: waHref,
            showWaWeb: true,
            disabledHint: "WhatsApp is not on file for this agent yet.",
          })}
          {renderContactRow({
            icon: Mail,
            label: "Email",
            value: agentEmail,
            href: mailHref,
            disabledHint: "Email is not published for this listing.",
          })}
        </div>

        <p className={styles.lede}>
          Choose how you would like to reach out. For a richer note, message via BelizeListings when
          available.
        </p>

        {canMessageViaSite ? (
          <button type="button" className={styles.siteMessageBtn} onClick={() => onOpenSiteMessage()}>
            Message via BelizeListings
          </button>
        ) : (
          <p className={styles.inboxDisabled} aria-disabled="true">
            Message via BelizeListings — coming soon
          </p>
        )}
      </div>
    </div>
  );
}
