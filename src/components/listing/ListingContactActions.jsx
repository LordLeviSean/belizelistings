import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, MessageCircle, Share2 } from "lucide-react";
import ListingMessageModal from "./ListingMessageModal";
import ListingViewingModal from "./ListingViewingModal";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingContactActions.module.css";

function digitsOnly(s = "") {
  return String(s || "").replace(/\D/g, "");
}

export default function ListingContactActions({ listing, user }) {
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const menuWrapRef = useRef(null);

  const listingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/listing/${listing?.id}` : "";

  const waDigits = digitsOnly(listing?.agent_phone || "");
  const waHref =
    waDigits.length >= 7
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          `Hi — I'm interested in "${listing?.title || "this listing"}" on BelizeListings.\n${listingUrl}`
        )}`
      : `https://wa.me/?text=${encodeURIComponent(
          `Hi — I'm interested in "${listing?.title || "this listing"}" on BelizeListings.\n${listingUrl}`
        )}`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing?.title || "BelizeListings",
          url: listingUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(listingUrl);
      showToast({ type: "success", message: "Link copied" });
    } catch {
      showToast({ type: "info", message: "Unable to share from this device." });
    }
  };

  return (
    <section className={styles.wrap} aria-label="Contact and scheduling">
      <div className={styles.row}>
        <div className={styles.contactSlot} ref={menuWrapRef}>
          <button
            type="button"
            className={styles.primaryBtn}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MessageCircle size={18} strokeWidth={2} aria-hidden />
            Contact agent
            <ChevronDown size={16} strokeWidth={2} className={styles.chevron} aria-hidden />
          </button>
          {menuOpen ? (
            <div className={styles.menu} role="menu">
              <a href={waHref} className={styles.menuItem} target="_blank" rel="noopener noreferrer">
                WhatsApp agent
              </a>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setMessageOpen(true);
                }}
              >
                Send message
              </button>
            </div>
          ) : null}
        </div>

        <button type="button" className={styles.secondaryBtn} onClick={() => setViewingOpen(true)}>
          <CalendarClock size={18} strokeWidth={2} aria-hidden />
          Schedule viewing
        </button>

        <button type="button" className={styles.shareBtn} aria-label="Share listing" onClick={() => void handleShare()}>
          <Share2 size={17} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <ListingMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        listing={listing}
        user={user}
      />
      <ListingViewingModal
        open={viewingOpen}
        onClose={() => setViewingOpen(false)}
        listing={listing}
        user={user}
      />
    </section>
  );
}
