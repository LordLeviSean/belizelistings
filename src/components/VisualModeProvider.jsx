import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { syncVisualModeDocument } from "../lib/visualModeDocument";
import { normalizeVisualModeConfig, VISUAL_MODE_DEFAULTS } from "../lib/visualModeConfig";
import { readVisualModeCache, writeVisualModeCache } from "../lib/visualModeCache";
import { LIVE_PALETTE_MODE_EVENT } from "../utils/livePaletteMode";
import { PULSE_MODE_EVENT } from "../utils/pulseMode";
import { SEA_FLOW_MODE_EVENT } from "../utils/seaFlowMode";
import { SEA_FLOW_INTENSITY_EVENT } from "../utils/seaFlowIntensity";
import { supabase } from "../lib/supabaseClient";

const VisualModeContext = createContext(null);

function dispatchVisualModeEvents(config) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LIVE_PALETTE_MODE_EVENT, { detail: { enabled: config.livePalette } })
  );
  window.dispatchEvent(new CustomEvent(PULSE_MODE_EVENT, { detail: { enabled: config.pulse } }));
  window.dispatchEvent(new CustomEvent(SEA_FLOW_MODE_EVENT, { detail: { enabled: config.seaFlow } }));
  window.dispatchEvent(
    new CustomEvent(SEA_FLOW_INTENSITY_EVENT, { detail: { intensity: config.seaFlowIntensity } })
  );
}

function resolveInitialConfig(initialConfig) {
  if (initialConfig) return normalizeVisualModeConfig(initialConfig);
  if (typeof window !== "undefined") return readVisualModeCache();
  return { ...VISUAL_MODE_DEFAULTS };
}

export function VisualModeProvider({ children, initialConfig = null }) {
  const serverLoadedRef = useRef(Boolean(initialConfig));
  const fetchStartedRef = useRef(false);
  const [config, setConfig] = useState(() => resolveInitialConfig(initialConfig));
  const [configReady, setConfigReady] = useState(Boolean(initialConfig));
  const [updateError, setUpdateError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const applyConfirmedConfig = useCallback((nextConfig) => {
    const normalized = normalizeVisualModeConfig(nextConfig);
    setConfig(normalized);
    writeVisualModeCache(normalized);
    syncVisualModeDocument(normalized);
    dispatchVisualModeEvents(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    syncVisualModeDocument(config);
  }, [config]);

  useEffect(() => {
    if (serverLoadedRef.current || fetchStartedRef.current) return;
    fetchStartedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/visual-mode");
        if (!res.ok) throw new Error("fetch_failed");
        const data = await res.json();
        if (cancelled) return;
        applyConfirmedConfig(data);
        serverLoadedRef.current = true;
      } catch {
        if (cancelled) return;
        applyConfirmedConfig(VISUAL_MODE_DEFAULTS);
      } finally {
        if (!cancelled) setConfigReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyConfirmedConfig]);

  useEffect(() => {
    if (initialConfig) {
      applyConfirmedConfig(initialConfig);
      serverLoadedRef.current = true;
      setConfigReady(true);
    }
  }, [initialConfig, applyConfirmedConfig]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => syncVisualModeDocument(config);
    motionQuery.addEventListener("change", onMotionChange);
    return () => motionQuery.removeEventListener("change", onMotionChange);
  }, [config]);

  const updateVisualMode = useCallback(
    async (patch) => {
      const previous = config;
      const next = normalizeVisualModeConfig({ ...config, ...patch });
      setUpdating(true);
      setUpdateError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error("Sign in required to update visual mode settings");
        }

        const res = await fetch("/api/admin/visual-mode", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(next),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Failed to update visual mode settings");
        }

        applyConfirmedConfig(payload);
        return payload;
      } catch (err) {
        setConfig(previous);
        syncVisualModeDocument(previous);
        setUpdateError(err?.message || "Failed to update visual mode settings");
        throw err;
      } finally {
        setUpdating(false);
      }
    },
    [applyConfirmedConfig, config]
  );

  const setLivePalette = useCallback(
    (enabled) => updateVisualMode({ livePalette: Boolean(enabled) }),
    [updateVisualMode]
  );
  const setPulse = useCallback(
    (enabled) => updateVisualMode({ pulse: Boolean(enabled) }),
    [updateVisualMode]
  );
  const setSeaFlow = useCallback(
    (enabled) => updateVisualMode({ seaFlow: Boolean(enabled) }),
    [updateVisualMode]
  );
  const setSeaFlowIntensity = useCallback(
    (intensity) => updateVisualMode({ seaFlowIntensity: intensity }),
    [updateVisualMode]
  );

  const value = useMemo(
    () => ({
      livePalette: config.livePalette,
      pulse: config.pulse,
      seaFlow: config.seaFlow,
      seaFlowIntensity: config.seaFlowIntensity,
      configReady,
      updateError,
      updating,
      setLivePalette,
      setPulse,
      setSeaFlow,
      setSeaFlowIntensity,
      updateVisualMode,
    }),
    [
      config,
      configReady,
      updateError,
      updating,
      setLivePalette,
      setPulse,
      setSeaFlow,
      setSeaFlowIntensity,
      updateVisualMode,
    ]
  );

  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode() {
  const ctx = useContext(VisualModeContext);
  if (!ctx) {
    throw new Error("useVisualMode must be used within VisualModeProvider");
  }
  return ctx;
}
