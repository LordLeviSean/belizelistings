import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  getInstallationSnapshot,
  initInstallationState,
  requestInstall as invokeRequestInstall,
  subscribeInstallationState,
} from "./installationState";

/** @type {import('react').Context<import('./installationState').InstallationSnapshot & { requestInstall: typeof invokeRequestInstall } | null>} */
const InstallationStateContext = createContext(null);

/**
 * Shared PWA installation state. Mount once in `_app.js`.
 * Early `beforeinstallprompt` capture lives in `_document` bootstrap.
 */
export function InstallationStateProvider({ children }) {
  const [snapshot, setSnapshot] = useState(() =>
    typeof window === "undefined" ? getInstallationSnapshot() : getInstallationSnapshot()
  );
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initInstallationState();
    setSnapshot(getInstallationSnapshot());

    return subscribeInstallationState(setSnapshot);
  }, []);

  const value = useMemo(
    () => ({
      ...snapshot,
      requestInstall: invokeRequestInstall,
    }),
    [snapshot]
  );

  return (
    <InstallationStateContext.Provider value={value}>
      {children}
    </InstallationStateContext.Provider>
  );
}

export function useInstallationState() {
  const context = useContext(InstallationStateContext);
  if (!context) {
    throw new Error(
      "useInstallationState must be used within <InstallationStateProvider> (see pages/_app.js)."
    );
  }
  return context;
}
