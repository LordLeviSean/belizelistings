import { useEffect, useState } from "react";
import {
  SEA_FLOW_MODE_EVENT,
  SEA_FLOW_MODE_KEY,
  readSeaFlowMode,
  writeSeaFlowMode,
} from "../utils/seaFlowMode";

export default function useSeaFlowMode() {
  const [enabled, setEnabled] = useState(() => readSeaFlowMode());

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key && event.key !== SEA_FLOW_MODE_KEY) return;
      setEnabled(readSeaFlowMode());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.enabled === "boolean") {
        setEnabled(event.detail.enabled);
      } else {
        setEnabled(readSeaFlowMode());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SEA_FLOW_MODE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SEA_FLOW_MODE_EVENT, onCustom);
    };
  }, []);

  const setMode = (next) => {
    writeSeaFlowMode(Boolean(next));
  };

  return { enabled, setMode };
}
