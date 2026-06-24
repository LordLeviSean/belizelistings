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
import { Heart } from "lucide-react";
import { useAuthGate } from "./auth/AuthGateProvider";
import styles from "./FavoriteSignupPrompt.module.css";

const FavoriteSignupPromptContext = createContext(null);

function noop() {}

export function FavoriteSignupPromptProvider({ children }) {
  const { openLoginIfNeeded } = useAuthGate();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const primaryRef = useRef(null);
  const prevActiveRef = useRef(null);

  const openFavoriteSignupPrompt = useCallback(() => {
    setOpen(true);
  }, []);

  const closePrompt = useCallback(() => {
    setOpen(false);
  }, []);

  const confirmSignup = useCallback(() => {
    setOpen(false);
    openLoginIfNeeded({ signup: true });
  }, [openLoginIfNeeded]);

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

  const modal =
    open && typeof document !== "undefined"
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
                <Heart strokeWidth={1.85} />
              </div>
              <p className={styles.kicker}>Members only</p>
              <h2 id={titleId} className={styles.title}>
                Save this property?
              </h2>
              <p id={descId} className={styles.body}>
                Create a free BelizeListings account to save favorites across devices — then pick up exactly
                where you left off across our interactive map.
              </p>
              <p className={styles.hint}>Continue opens the signup form only after you confirm below.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={closePrompt}>
                  Not now
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  className={styles.btnPrimary}
                  onClick={confirmSignup}
                >
                  Continue to create account
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <FavoriteSignupPromptContext.Provider value={{ openFavoriteSignupPrompt }}>
      {children}
      {modal}
    </FavoriteSignupPromptContext.Provider>
  );
}

/**
 * Opens the BelizeListings-styled signup prompt when a guest tries to favorite.
 * Safe noop if rendered outside provider (should not happen in production).
 */
export function useFavoriteSignupPrompt() {
  const ctx = useContext(FavoriteSignupPromptContext);
  return ctx?.openFavoriteSignupPrompt ?? noop;
}
