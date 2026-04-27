import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SiteNav from "../../components/SiteNav";
import AgentAccessGate from "../../components/AgentAccessGate";
import useAuth from "../../hooks/useAuth";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/Dashboard.module.css";

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        setIsAgent(data?.role === "agent");
        setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading || profileLoading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading dashboard...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <h1 className={styles.title}>Agent Dashboard</h1>
        {isAgent ? (
          <div className={styles.linkRow}>
            <Link href="/dashboard/listings" className={styles.dashboardLink}>
              My Listings
            </Link>
            <Link href="/dashboard/create" className={styles.dashboardLink}>
              Create Listing
            </Link>
          </div>
        ) : (
          <AgentAccessGate user={user} />
        )}
      </main>
    </div>
  );
}
