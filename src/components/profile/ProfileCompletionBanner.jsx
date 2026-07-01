import { useState } from "react";
import Link from "next/link";
import useUserRole from "@/hooks/useUserRole";
import { isProfileComplete } from "@/lib/isProfileComplete";
import styles from "./ProfileCompletionBanner.module.css";

/**
 * Soft prompt for existing users missing required phone after login.
 * @param {{ profileTabHref?: string, dismissible?: boolean }} props
 */
export default function ProfileCompletionBanner({
  profileTabHref = "/dashboard/user?tab=profile",
  dismissible = true,
}) {
  const { profile, loading } = useUserRole();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed || isProfileComplete(profile)) {
    return null;
  }

  return (
    <div className={styles.banner} role="status">
      <div className={styles.copy}>
        <p className={styles.title}>Complete your contact profile</p>
        <p className={styles.body}>
          Add a phone number so buyers can reach you and so you can submit listings for review.
        </p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.cta} href={profileTabHref}>
          Add phone
        </Link>
        {dismissible ? (
          <button type="button" className={styles.dismiss} onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
