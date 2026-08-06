import { Download } from "lucide-react";

import navStyles from "../SiteNavUnified.module.css";

/**
 * Permanent Install App navigation entry — opens the shared install modal.
 */
export default function InstallAppNavItem({ variant = "desktop", onOpen, onNavigate }) {
  const isDrawer = variant === "drawer";
  const linkBase = isDrawer
    ? `${navStyles.navLink} ${navStyles.drawerNavLink}`
    : navStyles.navLink;

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        onOpen?.();
      }}
      className={`${linkBase} ${navStyles.navPillInstall}`}
    >
      <span className={navStyles.navLinkInner}>
        <Download className={navStyles.navIcon} strokeWidth={1.85} aria-hidden />
        Install App
      </span>
    </button>
  );
}
