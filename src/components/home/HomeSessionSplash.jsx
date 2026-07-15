import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOME_SPLASH_HOLD_MS,
  HOME_SPLASH_PALETTE,
  markHomeSplashSeenThisSession,
  shouldShowHomeSessionSplash,
} from "@/lib/homeSessionSplash";
import styles from "./HomeSessionSplash.module.css";

export default function HomeSessionSplash({ onResolved }) {
  const [phase, setPhase] = useState("visible");
  const holdTimerRef = useRef(null);
  const resolvedRef = useRef(false);

  const finish = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    markHomeSplashSeenThisSession();
    setPhase("fading");
    window.setTimeout(() => {
      setPhase("done");
      onResolved?.();
      const main = document.getElementById("home-main-content");
      if (main && typeof main.focus === "function") {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    }, 520);
  }, [onResolved]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    holdTimerRef.current = window.setTimeout(finish, HOME_SPLASH_HOLD_MS);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, [finish]);

  if (phase === "done") return null;

  return (
    <div
      className={`${styles.splash} ${phase === "fading" ? styles.fading : ""}`.trim()}
      aria-hidden="true"
      onClick={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          finish();
        }
      }}
      role="presentation"
    >
      <div className={styles.glowField} aria-hidden />
      <p className={styles.mark} aria-hidden>
        <span className={styles.markB} style={{ "--tone-a": HOME_SPLASH_PALETTE[0], "--tone-b": HOME_SPLASH_PALETTE[3] }}>
          B
        </span>
        <span className={styles.markL} style={{ "--tone-a": HOME_SPLASH_PALETTE[4], "--tone-b": HOME_SPLASH_PALETTE[5] }}>
          L
        </span>
      </p>
      <span className={styles.skipHint}>Tap to continue</span>
    </div>
  );
}

export function useHomeSessionSplashGate() {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setActive(shouldShowHomeSessionSplash());
    setReady(true);
  }, []);

  return {
    ready,
    showSplash: active,
    dismissSplash: () => setActive(false),
  };
}
