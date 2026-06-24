import { useState } from "react";
import { CalendarClock, MessageCircle, Share2 } from "lucide-react";
import ContactAgentModal from "./ContactAgentModal";
import ListingMessageModal from "./ListingMessageModal";
import ListingViewingBookingModal from "./ListingViewingBookingModal";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingContactActions.module.css";

export default function ListingContactActions({ listing, user }) {
  const { showToast } = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);

  const listingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/listing/${listing?.id}` : "";

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
        <div className={styles.rowLead}>
          <button type="button" className={styles.primaryBtn} onClick={() => setContactOpen(true)}>
            <MessageCircle size={18} strokeWidth={2} aria-hidden />
            Contact agent
          </button>

          <button type="button" className={styles.secondaryBtn} onClick={() => setViewingOpen(true)}>
            <CalendarClock size={18} strokeWidth={2} aria-hidden />
            Schedule viewing
          </button>
        </div>

        <button type="button" className={styles.shareBtn} aria-label="Share listing" onClick={() => void handleShare()}>
          <Share2 size={17} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <ContactAgentModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        listing={listing}
        onOpenSiteMessage={() => {
          setContactOpen(false);
          setMessageOpen(true);
        }}
      />
      <ListingMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        listing={listing}
        user={user}
      />
      <ListingViewingBookingModal open={viewingOpen} onClose={() => setViewingOpen(false)} listing={listing} />
    </section>
  );
}
