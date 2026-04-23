import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import useAuth from "../hooks/useAuth";
import { readNavAlertBadge } from "../utils/navBadge";
import styles from "./SiteNav.module.css";

/**
 * @param {{ active?: "browse" | "favorites" | "saved" }} props
 */
export default function SiteNav({ active = "browse" }) {
  const [alertCount, setAlertCount] = useState(0);
  const { user, loading } = useAuth();

  useEffect(() => {
    const sync = () => setAlertCount(readNavAlertBadge());
    sync();
    window.addEventListener("belize-nav-badge", sync);
    return () => window.removeEventListener("belize-nav-badge", sync);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  };

  return (
    <header className={styles.navbar}>
      <Link href="/" className={styles.brand}>
        BelizeListings
      </Link>

      <nav className={styles.navLinks} aria-label="Primary navigation">
        <Link
          href="/"
          className={`${styles.navLink} ${active === "browse" ? styles.navLinkActive : ""}`}
        >
          Browse
        </Link>

        <Link
          href="/favorites"
          className={`${styles.navLink} ${active === "favorites" ? styles.navLinkActive : ""}`}
        >
          Favorites
        </Link>

        <Link
          href="/saved-searches"
          className={`${styles.navLink} ${styles.savedNavLink} ${
            active === "saved" ? styles.navLinkActive : ""
          }`}
        >
          <span className={styles.savedNavLabel}>
            Saved Searches
            {alertCount > 0 && (
              <span className={styles.alertBadge} aria-label={`${alertCount} new matches`}>
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </span>
        </Link>

        <span className={styles.navLink}>List Property</span>
        <span className={styles.navLink}>Agents</span>
        {loading ? (
          <span className={styles.navLink}>...</span>
        ) : user ? (
          <button type="button" onClick={handleLogout} className={styles.navBtn}>
            Logout
          </button>
        ) : (
          <Link href="/login" className={styles.navLink}>
            Sign In
          </Link>
        )}
      </nav>
    </header>
  );
}
