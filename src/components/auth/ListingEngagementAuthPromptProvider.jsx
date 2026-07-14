import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarClock, MessageCircle } from "lucide-react";
import { useAuthGate } from "./AuthGateProvider";
import {
  LISTING_ENGAGEMENT_ACTIONS,
  buildListingReturnPath,
  normalizeReturnTo,
  savePendingListingEngagement,
} from "@/lib/authEngagementReturn";
import styles from "../FavoriteSignupPrompt.module.css";

const ListingEngagementAuthPromptContext = createContext(null);

const COPY = {
  [LISTING_ENGAGEMENT_ACTIONS.MESSAGE]: {
    kicker: "Members participate",
    title: "Sign in to message the agent",
    body: "Internal messages on BelizeListings stay in one secure thread — create a free account to continue this conversation.",
    primary: "Continue to sign in",
  },
  [LISTING_ENGAGEMENT_ACTIONS.VIEWING]: {
    kicker: "Members participate",
    title: "Sign in to schedule a viewing",
    body: "Viewings are saved to your account so agents can confirm times and you can track updates.",
    primary: "Continue to sign in",
  },
};

function noop() {}

export function ListingEngagementAuthPromptProvider({ children }) {
  const { openLoginIfNeeded } = useAuthGate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef(null);
  const prevActiveRef = useRef(null);

  const closePrompt = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  const openListingEngagementPrompt = useCallback(({ action, listingId, returnPath }) => {
    const id = String(listingId || "").trim();
    if (!id || !COPY[action]) return;
    setPending({
      action,
      listingId: id,
      returnPath: normalizeReturnTo(returnPath) || buildListingReturnPath(id),
    });
    setOpen(true);
  }, []);

  const confirmAuth = useCallback(() => {
    if (!pending) return;
    savePendingListingEngagement(pending);
    setOpen(false);
    openLoginIfNeeded({ signup: true, returnTo: pending.returnPath });
    setPending(null);
  }, [openLoginIfNeeded, pending]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") closePrompt();
    };
    document.addEventListener("keydown", onKey);
    prevActiveRef.current = document.activeElement;
    const t = window.setTimeout(() => {
      primaryRef.current?.focus();
    }, 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (prevActiveRef.current && typeof prevActiveRef.current.focus === "function") {
        try {
          prevActiveRef.current.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, closePrompt]);

  const copy = pending ? COPY[pending.action] : null;
  const Icon = pending?.action === LISTING_ENGAGEMENT_ACTIONS.VIEWING ? CalendarClock : MessageCircle;

  const modal =
    open && copy && typeof document !== "undefined"
      ? createPortal(
          <div className={styles.root}>
            <button
              type="button"
              className={styles.backdrop}
              aria-label="Close"
              onClick={closePrompt}
            />
            <div
              className={styles.card}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className={styles.iconWrap} aria-hidden>
                <Icon strokeWidth={1.85} />
              </div>
              <p className={styles.kicker}>{copy.kicker}</p>
              <h2 id={titleId} className={styles.title}>
                {copy.title}
              </h2>
              <p id={descId} className={styles.body}>
                {copy.body}
              </p>
              <p className={styles.hint}>Phone, WhatsApp, and email remain available without an account.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={closePrompt}>
                  Not now
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  className={styles.btnPrimary}
                  onClick={confirmAuth}
                >
                  {copy.primary}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <ListingEngagementAuthPromptContext.Provider value={{ openListingEngagementPrompt }}>
      {children}
      {modal}
    </ListingEngagementAuthPromptContext.Provider>
  );
}

export function useListingEngagementAuthPrompt() {
  const ctx = useContext(ListingEngagementAuthPromptContext);
  return ctx?.openListingEngagementPrompt ?? noop;
}
