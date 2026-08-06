import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  advanceLoadingStage,
  BELIZE_MAP_SVG_URL,
  HOME_LOADING_MAX_MS,
} from "@/lib/homePageReadiness";
import {
  markHomeSplashSeenThisSession,
  prefersReducedMotionSplash,
  shouldShowHomeLoadingTransition,
} from "@/lib/homeSessionSplash";
import styles from "./HomeMapAwakensTransition.module.css";

const FADE_MS = 640;

export default function HomeMapAwakensTransition({ ready = false, onResolved }) {
  const [phase, setPhase] = useState("visible");
  const [visualStage, setVisualStage] = useState(1);
  const [mapMarkup, setMapMarkup] = useState("");
  const resolvedRef = useRef(false);
  const mountMsRef = useRef(Date.now());
  const reducedMotion = prefersReducedMotionSplash();

  const finish = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    markHomeSplashSeenThisSession();
    setPhase("dissolving");
    window.setTimeout(() => {
      setPhase("done");
      onResolved?.();
    }, FADE_MS);
  }, [onResolved]);

  useEffect(() => {
    let mounted = true;
    const loadMap = async () => {
      try {
        const response = await fetch(BELIZE_MAP_SVG_URL);
        if (!response.ok) return;
        const svgText = await response.text();
        if (mounted) setMapMarkup(svgText);
      } catch {
        /* silhouette optional */
      }
    };
    void loadMap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "visible") return undefined;
    const tick = () => {
      const elapsed = Date.now() - mountMsRef.current;
      setVisualStage(advanceLoadingStage(elapsed, reducedMotion));
    };
    tick();
    const interval = window.setInterval(tick, 80);
    return () => window.clearInterval(interval);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "visible" || !ready) return undefined;
    finish();
    return undefined;
  }, [ready, phase, finish]);

  useEffect(() => {
    if (phase !== "visible") return undefined;
    const maxTimer = window.setTimeout(finish, HOME_LOADING_MAX_MS);
    return () => window.clearTimeout(maxTimer);
  }, [phase, finish]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const mapInnerHtml = useMemo(() => {
    if (!mapMarkup) return undefined;
    return { __html: mapMarkup };
  }, [mapMarkup]);

  if (phase === "done") return null;

  const stageClass = `stage${visualStage}`;

  return (
    <div
      className={`${styles.overlay} ${stageClass} ${phase === "dissolving" ? styles.dissolving : ""}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      <div className={styles.depthLayer} aria-hidden />
      <div className={styles.causticLayer} aria-hidden />
      <div className={styles.content}>
        <div className={styles.mapFrame} aria-hidden>
          <div className={styles.districtAura} aria-hidden />
          <div className={styles.mapGlowSweep} aria-hidden />
          {mapInnerHtml ? (
            <div className={styles.mapSilhouette} dangerouslySetInnerHTML={mapInnerHtml} />
          ) : (
            <div className={styles.mapSilhouette} aria-hidden />
          )}
        </div>
        <p className={styles.wordmark} aria-hidden>
          BelizeListings
        </p>
        <p className={styles.loadingCopy} aria-hidden>
          Loading Belize&apos;s Living Property Map…
        </p>
        <p className={styles.srOnly}>Loading homepage content</p>
      </div>
    </div>
  );
}

export function useHomeLoadingTransitionGate() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(shouldShowHomeLoadingTransition());
  }, []);

  return {
    showTransition: active,
    dismissTransition: () => setActive(false),
  };
}
