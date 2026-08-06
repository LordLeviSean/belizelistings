import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, X } from "lucide-react";

import { useInstallationState } from "@/hooks/useInstallationState";
import { INSTALLATION_OUTCOMES } from "@/lib/pwa/installationState";

import styles from "./InstallAppModal.module.css";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const INSTALL_LEAD_COPY =
  "Add BelizeListings to your device for faster access and a focused app-style experience.";

const IOS_STEPS = [
  "Open BelizeListings in Safari, if necessary.",
  {
    type: "share",
    before: "Tap the ",
    after: " button.",
  },
  "Select “Add to Home Screen.”",
  "Tap “Add.”",
];

/**
 * Shared install interface for desktop and mobile navigation entry points.
 */
export default function InstallAppModal({ isOpen, onClose, returnFocusRef }) {
  const descriptionId = useId();
  const panelRef = useRef(null);
  const primaryActionRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState(null);

  const {
    nativePromptAvailable,
    isIosManualInstallEligible,
    isInstalled,
    requestInstall,
  } = useInstallationState();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setInstalling(false);
      setFallbackMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isInstalled && isOpen) {
      onClose?.();
    }
  }, [isInstalled, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const prevOverscroll = document.body.style.overscrollBehavior;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape" || installing) return;
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, installing]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return undefined;
    const modal = panelRef.current;
    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    (primaryActionRef.current || first)?.focus();

    const onKeyDown = (e) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    modal.addEventListener("keydown", onKeyDown);
    return () => modal.removeEventListener("keydown", onKeyDown);
  }, [isOpen, installing, nativePromptAvailable, isIosManualInstallEligible, fallbackMessage]);

  useEffect(() => {
    if (isOpen) return undefined;
    const target = returnFocusRef?.current;
    if (target && typeof target.focus === "function") {
      target.focus();
    }
    return undefined;
  }, [isOpen, returnFocusRef]);

  if (!isOpen || !mounted) return null;

  const showNativeAction = nativePromptAvailable;
  const showIosGuidance = isIosManualInstallEligible && !nativePromptAvailable;

  const handleNativeInstall = async () => {
    if (installing || !nativePromptAvailable) return;
    setInstalling(true);
    setFallbackMessage(null);
    try {
      const result = await requestInstall();
      if (result.outcome === INSTALLATION_OUTCOMES.ACCEPTED) {
        onClose?.();
        return;
      }
      if (result.outcome === INSTALLATION_OUTCOMES.DISMISSED) {
        onClose?.();
        return;
      }
      setFallbackMessage("Installation isn't available from this browser right now.");
    } catch {
      setFallbackMessage("Installation isn't available from this browser right now.");
    } finally {
      setInstalling(false);
    }
  };

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (installing) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        aria-describedby={descriptionId}
      >
        <div className={styles.head}>
          <div className={styles.headMain}>
            <div className={styles.iconWrap}>
              <img
                src="/android-chrome-192x192.png"
                alt=""
                width={56}
                height={56}
                className={styles.icon}
              />
            </div>
            <h2 id="install-app-title" className={styles.title}>
              Install BelizeListings
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close install dialog"
            disabled={installing}
            onClick={() => onClose?.()}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <p id={descriptionId} className={styles.lead}>
            {INSTALL_LEAD_COPY}
          </p>

          {fallbackMessage ? <p className={styles.fallback}>{fallbackMessage}</p> : null}

          {showIosGuidance ? (
            <>
              <ol className={styles.iosList}>
                {IOS_STEPS.map((step, index) => (
                  <li key={index} className={styles.iosStep}>
                    <span className={styles.stepNumber}>{index + 1}.</span>
                    <span className={styles.stepText}>
                      {typeof step === "string" ? (
                        step
                      ) : (
                        <>
                          {step.before}
                          <span className={styles.shareInline}>
                            Share
                            <Share2 className={styles.shareIcon} aria-hidden />
                          </span>
                          {step.after}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className={styles.safariNote}>
                If Add to Home Screen is unavailable in your current browser, open BelizeListings
                in Safari to complete installation.
              </p>
            </>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={installing}
            onClick={() => onClose?.()}
          >
            Close
          </button>
          {showNativeAction ? (
            <button
              ref={primaryActionRef}
              type="button"
              className={styles.btnPrimary}
              disabled={installing}
              aria-busy={installing || undefined}
              onClick={handleNativeInstall}
            >
              {installing ? "Installing…" : "Install App"}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

export { INSTALL_LEAD_COPY, IOS_STEPS };
