import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { BL_ENABLE_CONVERSATIONS } from "@/lib/featureFlags";
import {
  copyTextToClipboard,
  isMobileContactDevice,
  MOBILE_CONTACT_MQ,
} from "@/lib/deviceDetection";
import {
  hasPublicDirectContactMethods,
  resolveListingContact,
  resolveListingContactFromListingFields,
} from "@/lib/listingContactResolver";
import { useToast } from "@/components/ui/ToastProvider";
import ListingInteractionModal from "./ListingInteractionModal";
import styles from "./ContactAgentModal.module.css";

function digitsOnly(s = "") {
  return String(s || "").replace(/\D/g, "");
}

function looksLikeEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function formatBelizePhoneDisplay(raw = "") {
  const digits = digitsOnly(raw);
  if (digits.length < 7) return "";
  const normalized = digits.startsWith("501") ? digits : `501${digits.replace(/^0+/, "")}`;
  if (normalized.length === 10) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
  }
  return raw.trim();
}

function formatPhoneHref(raw = "") {
  const digits = digitsOnly(raw);
  if (digits.length < 7) return "";
  const normalized = digits.startsWith("501") ? digits : `501${digits.replace(/^0+/, "")}`;
  return `tel:+${normalized}`;
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
  const hasDirectContact = hasPublicDirectContactMethods(contact);

  const phoneRaw = contact?.showPhonePublic !== false ? String(contact?.phone || "").trim() : "";
  const hasPhone = digitsOnly(phoneRaw).length >= 7;
  const phoneDisplay = hasPhone ? formatBelizePhoneDisplay(phoneRaw) : "";
  const phoneHref = hasPhone ? formatPhoneHref(phoneRaw) : "";

  const waRaw =
    contact?.showPhonePublic !== false
      ? String(contact?.whatsapp || contact?.phone || "").trim()
      : "";
  const waDigits = digitsOnly(waRaw);
  const hasWhatsApp = waDigits.length >= 7;
  const waDisplay = hasWhatsApp ? formatBelizePhoneDisplay(waRaw) : "";
  const waHref = hasWhatsApp
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Hi — I'm interested in "${listing?.title || "this listing"}" on BelizeListings.\n${listingUrl}`
      )}`
    : "";

  const agentEmail = contact?.showEmailPublic === true ? String(contact?.email || "").trim() : "";
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

  const handleCopy = async (label, value) => {
    const ok = await copyTextToClipboard(value);
    showToast({
      type: ok ? "success" : "info",
      message: ok ? `${label} copied` : `Could not copy ${label.toLowerCase()}.`,
    });
  };

  const renderContactRow = ({
    icon: Icon,
    label,
    value,
    href,
    disabledHint,
    showWaWeb,
    copyValue,
  }) => {
    const copyTarget = copyValue ?? value;
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
        <a
          href={href}
          className={styles.contactRow}
          onClick={() => onClose?.()}
          target={showWaWeb ? "_blank" : undefined}
          rel={showWaWeb ? "noopener noreferrer" : undefined}
        >
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
          {showWaWeb && href ? (
            <a
              href={href}
              className={styles.primaryActionBtn}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClose?.()}
            >
              Open WhatsApp Web
            </a>
          ) : null}
          <button
            type="button"
            className={showWaWeb ? styles.secondaryCopyBtn : styles.copyBtn}
            aria-label={`Copy ${label}`}
            onClick={() => void handleCopy(label, copyTarget)}
          >
            <Copy size={14} aria-hidden />
            Copy
          </button>
        </div>
      </div>
    );
  };

  return (
    <ListingInteractionModal
      isOpen={open}
      onClose={onClose}
      title="Contact agent"
      titleId="contact-agent-title"
      compact
    >
      <div className={styles.hero}>
        <div className={styles.avatar} aria-hidden>
          {initial}
        </div>
        <div className={styles.heroText}>
          <p className={styles.agentName}>{displayName}</p>
          {brokerageLabel ? <p className={styles.brokerage}>{brokerageLabel}</p> : null}
          {listing?.title ? (
            <p className={styles.listingContext}>{listing.title}</p>
          ) : null}
        </div>
      </div>

      {!hasDirectContact ? (
        <p className={styles.privateContactNotice}>
          Direct contact details are private. Send a secure message through BelizeListings.
        </p>
      ) : (
        <div className={styles.contactCard} aria-label="Agent contact details">
          {renderContactRow({
            icon: Phone,
            label: "Phone",
            value: phoneDisplay,
            href: phoneHref,
          })}
          {renderContactRow({
            icon: MessageCircle,
            label: "WhatsApp",
            value: waDisplay,
            copyValue: waDigits || waDisplay,
            href: waHref,
            showWaWeb: true,
          })}
          {hasEmail
            ? renderContactRow({
                icon: Mail,
                label: "Email",
                value: agentEmail,
                href: mailHref,
              })
            : null}
        </div>
      )}

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
    </ListingInteractionModal>
  );
}
