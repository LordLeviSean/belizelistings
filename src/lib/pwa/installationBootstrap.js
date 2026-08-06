/** Window bridge populated by the inline bootstrap before React hydration. */
export const PWA_INSTALL_BRIDGE_KEY = "__blPwaInstallBridge";

/** Custom event dispatched when the bootstrap bridge mutates. */
export const PWA_INSTALL_BRIDGE_UPDATE_EVENT = "bl-pwa-install-bridge-update";

/**
 * Inline bootstrap for `_document` — attaches install listeners before hydration.
 * Mirrors the visual-mode bootstrap pattern; no CSP weakening required today.
 */
export function getInstallationBootstrapScript() {
  return `(function(){try{var k="${PWA_INSTALL_BRIDGE_KEY}";if(window[k]&&window[k].bootstrapped)return;var b=window[k]={bootstrapped:true,deferredPrompt:null,appInstalled:false,beforeInstallPromptSeen:false};window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();b.beforeInstallPromptSeen=true;b.deferredPrompt=e;window.dispatchEvent(new CustomEvent("${PWA_INSTALL_BRIDGE_UPDATE_EVENT}"));});window.addEventListener("appinstalled",function(){b.appInstalled=true;b.deferredPrompt=null;window.dispatchEvent(new CustomEvent("${PWA_INSTALL_BRIDGE_UPDATE_EVENT}"));});}catch(e){}})();`;
}
