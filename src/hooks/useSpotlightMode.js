import { useEffect, useState } from "react";
import {
  LIVE_PALETTE_SPOTLIGHT_MODE_EVENT,
  LIVE_PALETTE_SPOTLIGHT_MODE_KEY,
  readSpotlightMode,
  writeSpotlightMode,
} from "../utils/spotlightMode";

export default function useSpotlightMode() {
  const [enabled, setEnabled] = useState(() => readSpotlightMode());

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key && event.key !== LIVE_PALETTE_SPOTLIGHT_MODE_KEY) return;
      setEnabled(readSpotlightMode());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.enabled === "boolean") {
        setEnabled(event.detail.enabled);
      } else {
        setEnabled(readSpotlightMode());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(LIVE_PALETTE_SPOTLIGHT_MODE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LIVE_PALETTE_SPOTLIGHT_MODE_EVENT, onCustom);
    };
  }, []);

  const setMode = (next) => {
    writeSpotlightMode(Boolean(next));
  };

  return { enabled, setMode };
}

