import { createContext, useContext, useEffect, useMemo } from "react";
import useLivePaletteMode from "../hooks/useLivePaletteMode";
import usePulseMode from "../hooks/usePulseMode";
import useSeaFlowMode from "../hooks/useSeaFlowMode";
import useSeaFlowIntensity from "../hooks/useSeaFlowIntensity";
import { syncVisualModeDocument } from "../lib/visualModeDocument";
import { LIVE_PALETTE_MODE_EVENT } from "../utils/livePaletteMode";
import { PULSE_MODE_EVENT } from "../utils/pulseMode";
import { SEA_FLOW_MODE_EVENT } from "../utils/seaFlowMode";
import { SEA_FLOW_INTENSITY_EVENT } from "../utils/seaFlowIntensity";

const VisualModeContext = createContext(null);

export function VisualModeProvider({ children }) {
  const { enabled: livePalette, setMode: setLivePalette } = useLivePaletteMode();
  const { enabled: pulse, setMode: setPulse } = usePulseMode();
  const { enabled: seaFlow, setMode: setSeaFlow } = useSeaFlowMode();
  const { intensity: seaFlowIntensity, setIntensity: setSeaFlowIntensity } = useSeaFlowIntensity();

  useEffect(() => {
    syncVisualModeDocument({
      livePalette,
      pulse,
      seaFlow,
      seaFlowIntensity,
    });
  }, [livePalette, pulse, seaFlow, seaFlowIntensity]);

  useEffect(() => {
    const resync = () => syncVisualModeDocument();
    window.addEventListener(LIVE_PALETTE_MODE_EVENT, resync);
    window.addEventListener(PULSE_MODE_EVENT, resync);
    window.addEventListener(SEA_FLOW_MODE_EVENT, resync);
    window.addEventListener(SEA_FLOW_INTENSITY_EVENT, resync);
    window.addEventListener("storage", resync);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => syncVisualModeDocument();
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      window.removeEventListener(LIVE_PALETTE_MODE_EVENT, resync);
      window.removeEventListener(PULSE_MODE_EVENT, resync);
      window.removeEventListener(SEA_FLOW_MODE_EVENT, resync);
      window.removeEventListener(SEA_FLOW_INTENSITY_EVENT, resync);
      window.removeEventListener("storage", resync);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  const value = useMemo(
    () => ({
      livePalette,
      pulse,
      seaFlow,
      seaFlowIntensity,
      setLivePalette,
      setPulse,
      setSeaFlow,
      setSeaFlowIntensity,
    }),
    [
      livePalette,
      pulse,
      seaFlow,
      seaFlowIntensity,
      setLivePalette,
      setPulse,
      setSeaFlow,
      setSeaFlowIntensity,
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
