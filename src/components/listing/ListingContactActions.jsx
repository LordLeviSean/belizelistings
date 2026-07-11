import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { CalendarClock, MessageCircle, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { fetchListingOwnerContact } from "@/lib/listingContactResolver";
import { resolveListingAgentUserId, resolveListingAgentUserIdAsync } from "@/lib/listingInquiryTargets";
import {
  getListingAvailabilityMessage,
  isListingEngagementEnabled,
} from "@/utils/canonicalListing";
import { useListingEngagementAuthPrompt } from "@/components/auth/ListingEngagementAuthPromptProvider";
import {
  LISTING_ENGAGEMENT_ACTIONS,
  clearPendingListingEngagement,
  readPendingListingEngagement,
} from "@/lib/authEngagementReturn";

const ContactAgentModal = dynamic(() => import("./ContactAgentModal"), { ssr: false });
const ListingMessageModal = dynamic(() => import("./ListingMessageModal"), { ssr: false });
const ListingViewingBookingModal = dynamic(() => import("./ListingViewingBookingModal"), { ssr: false });
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./ListingContactActions.module.css";

const MOBILE_STICKY_MQ = "(max-width: 520px)";

export default function ListingContactActions({ listing, user }) {
  const router = useRouter();
  const openListingEngagementPrompt = useListingEngagementAuthPrompt();
  const { showToast } = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [ownerContact, setOwnerContact] = useState(null);
  const [agentUserIdResolved, setAgentUserIdResolved] = useState(null);

  const listingReturnPath = router.asPath || `/listing/${listing?.id}`;
  const engagementEnabled = isListingEngagementEnabled(listing);
  const availabilityMessage = getListingAvailabilityMessage(listing);

  const listingAgentUserId = useMemo(
    () => agentUserIdResolved || resolveListingAgentUserId(listing, ownerContact),
    [agentUserIdResolved, listing, ownerContact]
  );

  useEffect(() => {
    if (!listing?.id) {
      setOwnerContact(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { contact } = await fetchListingOwnerContact(supabase, listing.id);
      if (!cancelled) setOwnerContact(contact);
    })();
    return () => {
      cancelled = true;
    };
  }, [listing?.id]);

  useEffect(() => {
    if (!listing?.id) {
      setAgentUserIdResolved(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveListingAgentUserIdAsync(supabase, listing, ownerContact);
      if (!cancelled) setAgentUserIdResolved(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [listing, ownerContact]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia(MOBILE_STICKY_MQ);
    if (!mq.matches) return undefined;

    const footer = document.querySelector("footer");
    if (!footer) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    observer.observe(footer);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!user?.id || !listing?.id) return;
    const pending = readPendingListingEngagement(listing.id);
    if (!pending) return;
    clearPendingListingEngagement();
    if (pending.action === LISTING_ENGAGEMENT_ACTIONS.MESSAGE) {
      setMessageOpen(true);
    } else if (pending.action === LISTING_ENGAGEMENT_ACTIONS.VIEWING) {
      setViewingOpen(true);
    }
  }, [user?.id, listing?.id]);

  const requestSiteMessage = useCallback(() => {
    setContactOpen(false);
    if (!engagementEnabled) {
      showToast({ type: "info", message: availabilityMessage });
      return;
    }
    if (!user?.id) {
      openListingEngagementPrompt({
        action: LISTING_ENGAGEMENT_ACTIONS.MESSAGE,
        listingId: listing?.id,
        returnPath: listingReturnPath,
      });
      return;
    }
    setMessageOpen(true);
  }, [user?.id, listing?.id, listingReturnPath, openListingEngagementPrompt, engagementEnabled, availabilityMessage, showToast]);

  const requestScheduleViewing = useCallback(() => {
    if (!engagementEnabled) {
      showToast({ type: "info", message: availabilityMessage });
      return;
    }
    if (!user?.id) {
      openListingEngagementPrompt({
        action: LISTING_ENGAGEMENT_ACTIONS.VIEWING,
        listingId: listing?.id,
        returnPath: listingReturnPath,
      });
      return;
    }
    setViewingOpen(true);
  }, [user?.id, listing?.id, listingReturnPath, openListingEngagementPrompt, engagementEnabled, availabilityMessage, showToast]);

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

  const wrapClass = [
    styles.wrap,
    footerVisible ? styles.wrapFooterClear : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={wrapClass} aria-label="Contact and scheduling">
      {!engagementEnabled ? (
        <p className={styles.unavailableNote} role="status">
          {availabilityMessage}
        </p>
      ) : null}
      <div className={styles.row}>
        <div className={styles.rowLead}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setContactOpen(true)}
            disabled={!engagementEnabled}
          >
            <MessageCircle size={18} strokeWidth={2} aria-hidden />
            Contact agent
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={requestScheduleViewing}
            disabled={!engagementEnabled}
          >
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
        contact={ownerContact}
        onOpenSiteMessage={requestSiteMessage}
      />
      <ListingMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        listing={listing}
        user={user}
        agentUserId={listingAgentUserId}
      />
      <ListingViewingBookingModal
        open={viewingOpen}
        onClose={() => setViewingOpen(false)}
        listing={listing}
        user={user}
        agentUserId={listingAgentUserId}
      />
    </section>
  );
}
