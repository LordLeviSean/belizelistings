import {
  PWA_INSTALL_BRIDGE_KEY,
  PWA_INSTALL_BRIDGE_UPDATE_EVENT,
} from "./installationBootstrap";

/** @typedef {'accepted' | 'dismissed' | 'installed' | 'unavailable' | null} InstallationOutcome */

export const INSTALLATION_OUTCOMES = Object.freeze({
  ACCEPTED: "accepted",
  DISMISSED: "dismissed",
  INSTALLED: "installed",
  UNAVAILABLE: "unavailable",
});

/**
 * @typedef {Object} InstallationSnapshot
 * @property {boolean} isSupported
 * @property {boolean} isInstallable
 * @property {boolean} isStandalone
 * @property {boolean} isInstalled
 * @property {boolean} isIos
 * @property {boolean} isIosManualInstallEligible
 * @property {boolean} nativePromptAvailable
 * @property {boolean} nativePromptPending
 * @property {InstallationOutcome} installationOutcome
 */

/** @type {Event | null} */
let deferredPrompt = null;
let promptConsumed = false;
/** @type {InstallationOutcome} */
let installationOutcome = null;
let appInstalledFlag = false;
let eligibilityResolved = false;
let initialized = false;
/** @type {Set<(snapshot: InstallationSnapshot) => void>} */
const listeners = new Set();
/** @type {(() => void) | null} */
let teardownDisplayModeListener = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let eligibilityTimer = null;

const ELIGIBILITY_SETTLE_MS = 2000;

function envWindow(env) {
  if (Object.prototype.hasOwnProperty.call(env, "window")) {
    return env.window || undefined;
  }
  return typeof window !== "undefined" ? window : undefined;
}

function envNavigator(env) {
  if (Object.prototype.hasOwnProperty.call(env, "navigator")) {
    return env.navigator || undefined;
  }
  return typeof navigator !== "undefined" ? navigator : undefined;
}

function envLocation(env) {
  if (Object.prototype.hasOwnProperty.call(env, "location")) {
    return env.location || undefined;
  }
  const win = envWindow(env);
  return win?.location;
}

function getBridge(win) {
  return win?.[PWA_INSTALL_BRIDGE_KEY] ?? null;
}

function isSecureContext(loc) {
  if (!loc) return false;
  const hostname = String(loc.hostname || "");
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  return loc.protocol === "https:" || isLocalhost;
}

/**
 * Conservative Apple mobile/tablet detection for manual Add to Home Screen guidance.
 * @param {{ navigator?: Navigator, window?: Window }} [env]
 */
export function detectIosDevice(env = {}) {
  const nav = envNavigator(env);
  if (!nav) return false;

  if (nav.standalone === true) return true;

  const ua = String(nav.userAgent || "");
  const platform = String(nav.platform || "");
  const maxTouchPoints = Number(nav.maxTouchPoints || 0);

  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (platform === "MacIntel" && maxTouchPoints > 1) return true;

  return false;
}

/**
 * @param {{ window?: Window, navigator?: Navigator }} [env]
 */
export function detectStandaloneDisplayMode(env = {}) {
  const win = envWindow(env);
  const nav = envNavigator(env);
  if (!win) return false;

  if (nav?.standalone === true) return true;

  try {
    return Boolean(win.matchMedia?.("(display-mode: standalone)")?.matches);
  } catch {
    return false;
  }
}

function isChromiumInstallCapable(env = {}) {
  const nav = envNavigator(env);
  const loc = envLocation(env);
  if (!nav || !loc) return false;
  if (detectIosDevice(env)) return false;
  return isSecureContext(loc) && "serviceWorker" in nav;
}

function syncDeferredPromptFromBridge(env = {}) {
  const win = envWindow(env);
  const bridge = getBridge(win);
  if (!bridge?.deferredPrompt || promptConsumed) return;
  deferredPrompt = bridge.deferredPrompt;
}

function markEligibilityResolved(env = {}) {
  if (eligibilityResolved) return;
  eligibilityResolved = true;
  if (eligibilityTimer) {
    clearTimeout(eligibilityTimer);
    eligibilityTimer = null;
  }
  notifyListeners(env);
}

/**
 * @param {{ window?: Window, navigator?: Navigator, location?: Location }} [env]
 * @returns {InstallationSnapshot}
 */
export function getInstallationSnapshot(env = {}) {
  const win = envWindow(env);
  const bridge = getBridge(win);

  if (bridge?.appInstalled) {
    appInstalledFlag = true;
    deferredPrompt = null;
    if (installationOutcome !== INSTALLATION_OUTCOMES.ACCEPTED) {
      installationOutcome = INSTALLATION_OUTCOMES.INSTALLED;
    }
  }

  syncDeferredPromptFromBridge(env);

  const isStandalone = detectStandaloneDisplayMode(env);
  const isIos = detectIosDevice(env);
  const nativePromptAvailable = Boolean(deferredPrompt) && !promptConsumed;
  const isInstalled = isStandalone || appInstalledFlag;
  const chromiumCapable = isChromiumInstallCapable(env);

  const nativePromptPending =
    !isInstalled &&
    chromiumCapable &&
    !nativePromptAvailable &&
    !eligibilityResolved;

  const isIosManualInstallEligible =
    isIos && !isStandalone && !nativePromptAvailable && !isInstalled;

  const isSupported =
    isStandalone ||
    isIos ||
    chromiumCapable ||
    nativePromptAvailable ||
    bridge?.beforeInstallPromptSeen === true;

  const isInstallable =
    !isInstalled && (nativePromptAvailable || isIosManualInstallEligible);

  return {
    isSupported,
    isInstallable,
    isStandalone,
    isInstalled,
    isIos,
    isIosManualInstallEligible,
    nativePromptAvailable,
    nativePromptPending,
    installationOutcome,
  };
}

function notifyListeners(env = {}) {
  const snapshot = getInstallationSnapshot(env);
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Listener failures must not break installation infrastructure.
    }
  });
}

function onBridgeUpdate(env) {
  syncDeferredPromptFromBridge(env);
  if (deferredPrompt) {
    markEligibilityResolved(env);
  }
  notifyListeners(env);
}

function onAppInstalled(env) {
  appInstalledFlag = true;
  deferredPrompt = null;
  promptConsumed = true;
  installationOutcome = INSTALLATION_OUTCOMES.INSTALLED;
  const bridge = getBridge(env.window);
  if (bridge) {
    bridge.deferredPrompt = null;
    bridge.appInstalled = true;
  }
  markEligibilityResolved(env);
  notifyListeners(env);
}

function attachDisplayModeListener(env = {}) {
  const win = envWindow(env);
  if (!win?.matchMedia) return () => {};

  const query = win.matchMedia("(display-mode: standalone)");
  const handler = () => notifyListeners(env);

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }

  query.addListener(handler);
  return () => query.removeListener(handler);
}

/**
 * Initialize the shared installation-state layer once per document.
 * @param {{ window?: Window, navigator?: Navigator, location?: Location }} [env]
 */
export function initInstallationState(env = {}) {
  if (initialized) {
    return getInstallationSnapshot(env);
  }

  const win = envWindow(env);
  if (!win) {
    return getInstallationSnapshot(env);
  }

  initialized = true;
  syncDeferredPromptFromBridge(env);

  if (deferredPrompt) {
    markEligibilityResolved(env);
  } else if (isChromiumInstallCapable(env)) {
    eligibilityTimer = setTimeout(() => markEligibilityResolved(env), ELIGIBILITY_SETTLE_MS);
  } else {
    eligibilityResolved = true;
  }

  win.addEventListener(PWA_INSTALL_BRIDGE_UPDATE_EVENT, () => onBridgeUpdate(env));
  win.addEventListener("appinstalled", () => onAppInstalled(env));

  teardownDisplayModeListener = attachDisplayModeListener(env);
  notifyListeners(env);

  return getInstallationSnapshot(env);
}

/**
 * @param {(snapshot: InstallationSnapshot) => void} listener
 * @returns {() => void}
 */
export function subscribeInstallationState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Invoke the native install prompt after an intentional user action.
 * @returns {Promise<{ ok: boolean, outcome: InstallationOutcome }>}
 */
export async function requestInstall() {
  const prompt = deferredPrompt;
  if (!prompt || promptConsumed) {
    return { ok: false, outcome: INSTALLATION_OUTCOMES.UNAVAILABLE };
  }

  promptConsumed = true;

  try {
    if (typeof prompt.prompt !== "function") {
      deferredPrompt = null;
      installationOutcome = INSTALLATION_OUTCOMES.UNAVAILABLE;
      notifyListeners();
      return { ok: false, outcome: INSTALLATION_OUTCOMES.UNAVAILABLE };
    }

    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPrompt = null;

    const bridge =
      typeof window !== "undefined" ? getBridge(window) : null;
    if (bridge) {
      bridge.deferredPrompt = null;
    }

    if (choice?.outcome === "accepted") {
      installationOutcome = INSTALLATION_OUTCOMES.ACCEPTED;
      notifyListeners();
      return { ok: true, outcome: INSTALLATION_OUTCOMES.ACCEPTED };
    }

    installationOutcome = INSTALLATION_OUTCOMES.DISMISSED;
    notifyListeners();
    return { ok: true, outcome: INSTALLATION_OUTCOMES.DISMISSED };
  } catch {
    deferredPrompt = null;
    installationOutcome = INSTALLATION_OUTCOMES.UNAVAILABLE;
    notifyListeners();
    return { ok: false, outcome: INSTALLATION_OUTCOMES.UNAVAILABLE };
  }
}

/** Test-only reset — not for production use. */
export function __resetInstallationStateForTests() {
  deferredPrompt = null;
  promptConsumed = false;
  installationOutcome = null;
  appInstalledFlag = false;
  eligibilityResolved = false;
  initialized = false;
  listeners.clear();
  if (eligibilityTimer) {
    clearTimeout(eligibilityTimer);
    eligibilityTimer = null;
  }
  if (teardownDisplayModeListener) {
    teardownDisplayModeListener();
    teardownDisplayModeListener = null;
  }
  if (typeof window !== "undefined") {
    delete window[PWA_INSTALL_BRIDGE_KEY];
  }
}
