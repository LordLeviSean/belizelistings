/**
 * Whether the permanent Install App nav entry should render.
 * @param {import('@/lib/pwa/installationState').InstallationSnapshot} state
 * @param {{ clientReady?: boolean }} [options]
 */
export function shouldShowInstallAppEntry(state, { clientReady = true } = {}) {
  if (!clientReady) return false;
  if (!state) return false;
  if (state.isInstalled || state.isStandalone) return false;
  if (state.nativePromptPending && !state.isIosManualInstallEligible) return false;
  return Boolean(state.isInstallable);
}
