import { useEffect, useState } from "react";
import {
  SEA_FLOW_INTENSITY_DEFAULT,
  SEA_FLOW_INTENSITY_EVENT,
  SEA_FLOW_INTENSITY_KEY,
  readSeaFlowIntensity,
  writeSeaFlowIntensity,
} from "../utils/seaFlowIntensity";

export default function useSeaFlowIntensity() {
  const [intensity, setIntensityState] = useState(SEA_FLOW_INTENSITY_DEFAULT);

  useEffect(() => {
    setIntensityState(readSeaFlowIntensity());

    const onStorage = (event) => {
      if (event.key && event.key !== SEA_FLOW_INTENSITY_KEY) return;
      setIntensityState(readSeaFlowIntensity());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.intensity === "number") {
        setIntensityState(event.detail.intensity);
      } else {
        setIntensityState(readSeaFlowIntensity());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SEA_FLOW_INTENSITY_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SEA_FLOW_INTENSITY_EVENT, onCustom);
    };
  }, []);

  const setIntensity = (next) => {
    writeSeaFlowIntensity(next);
    setIntensityState(readSeaFlowIntensity());
  };

  return { intensity, setIntensity };
}
