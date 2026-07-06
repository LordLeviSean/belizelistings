import { useEffect, useState } from "react";
import {
  HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT,
  HOMEPAGE_SEA_FLOW_MULTIPLIER_EVENT,
  HOMEPAGE_SEA_FLOW_MULTIPLIER_KEY,
  readHomepageSeaFlowMultiplier,
  writeHomepageSeaFlowMultiplier,
} from "../utils/homepageSeaFlowMultiplier";

export default function useHomepageSeaFlowMultiplier() {
  const [multiplier, setMultiplierState] = useState(HOMEPAGE_SEA_FLOW_MULTIPLIER_DEFAULT);

  useEffect(() => {
    setMultiplierState(readHomepageSeaFlowMultiplier());

    const onStorage = (event) => {
      if (event.key && event.key !== HOMEPAGE_SEA_FLOW_MULTIPLIER_KEY) return;
      setMultiplierState(readHomepageSeaFlowMultiplier());
    };

    const onCustom = (event) => {
      if (typeof event?.detail?.multiplier === "number") {
        setMultiplierState(event.detail.multiplier);
      } else {
        setMultiplierState(readHomepageSeaFlowMultiplier());
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(HOMEPAGE_SEA_FLOW_MULTIPLIER_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HOMEPAGE_SEA_FLOW_MULTIPLIER_EVENT, onCustom);
    };
  }, []);

  const setMultiplier = (next) => {
    writeHomepageSeaFlowMultiplier(next);
    setMultiplierState(readHomepageSeaFlowMultiplier());
  };

  return { multiplier, setMultiplier };
}
