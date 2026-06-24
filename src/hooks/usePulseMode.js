import { useEffect, useState } from "react";
import { PULSE_MODE_EVENT, PULSE_MODE_KEY, readPulseMode, writePulseMode } from "../utils/pulseMode";

export default function usePulseMode() {
  /** false on SSR and first client paint — sync from storage after mount (hydration-safe). */
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readPulseMode());

    const onStorage = (event) => {
      if (event.key && event.key !== PULSE_MODE_KEY) return;
      setEnabled(readPulseMode());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.enabled === "boolean") {
        setEnabled(event.detail.enabled);
      } else {
        setEnabled(readPulseMode());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(PULSE_MODE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PULSE_MODE_EVENT, onCustom);
    };
  }, []);

  const setMode = (next) => {
    writePulseMode(Boolean(next));
  };

  return { enabled, setMode };
}

