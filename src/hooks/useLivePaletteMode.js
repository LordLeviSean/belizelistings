import { useEffect, useState } from "react";
import {
  LIVE_PALETTE_MODE_EVENT,
  LIVE_PALETTE_MODE_KEY,
  readLivePaletteMode,
  writeLivePaletteMode,
} from "../utils/livePaletteMode";

export default function useLivePaletteMode() {
  const [enabled, setEnabled] = useState(() => readLivePaletteMode());

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key && event.key !== LIVE_PALETTE_MODE_KEY) return;
      setEnabled(readLivePaletteMode());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.enabled === "boolean") {
        setEnabled(event.detail.enabled);
      } else {
        setEnabled(readLivePaletteMode());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(LIVE_PALETTE_MODE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LIVE_PALETTE_MODE_EVENT, onCustom);
    };
  }, []);

  const setMode = (next) => {
    writeLivePaletteMode(Boolean(next));
  };

  return { enabled, setMode };
}

