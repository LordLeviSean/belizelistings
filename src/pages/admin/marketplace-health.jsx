import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import SiteNav from "../../components/SiteNav";
import AdminOperationalStats from "../../components/AdminOperationalStats";
import { DashboardShell } from "../../components/dashboard";
import { DASHBOARD_ROLE, DASHBOARD_ROLE_META } from "../../constants/dashboardRoles";
import useUserRole from "../../hooks/useUserRole";
import { supabase } from "../../lib/supabaseClient";
import { getOperationalLifecycleCountsFromDb } from "../../lib/listingOperationalStats";
import { fetchProfileCount } from "../../lib/profileSelectContract";
import styles from "../../styles/Dashboard.module.css";
import PremiumEmptyState from "../../components/ui/PremiumEmptyState";

function HealthStat({ label, value, sublabel }) {
  return (
    <div className={styles.operationalStatCard} role="group" aria-label={label}>
      <div className={styles.operationalStatAccent} aria-hidden />
      <p className={styles.operationalStatLabel}>{label}</p>
      <p className={styles.operationalStatValue}>{value ?? "—"}</p>
      {sublabel ? <p className={styles.operationalStatSub}>{sublabel}</p> : null}
    </div>
  );
}

export default function MarketplaceHealthPage() {
  const router = useRouter();
  const { user, role, loading: roleLoading, welcomePhrase } = useUserRole();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [healthLoading, setHealthLoading] = useState(false);
  const [totals, setTotals] = useState({
    listings: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
    users: 0,
  });

  const refreshStats = useCallback(async () => {
    const [operational, { count: usersCount }] = await Promise.all([
      getOperationalLifecycleCountsFromDb(supabase),
      fetchProfileCount(supabase),
    ]);
    setTotals({
      listings: operational.totalOperational,
      pending: operational.pending,
      approved: operational.approved,
      rejected: operational.rejected,
      archived: operational.archived,
      users: usersCount ?? 0,
    });
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      setHealthError("Session expired — sign in again.");
      setHealthLoading(false);
      return;
    }
    const res = await fetch("/api/admin/marketplace-health", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    setHealthLoading(false);
    if (!res.ok) {
      setHealthError(body.error || "Could not load marketplace health.");
      return;
    }
    setHealth(body);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (roleLoading) return;
      if (!user) {
        setCheckingAccess(false);
        router.replace("/login");
        return;
      }
      if (role !== "admin") {
        setCheckingAccess(false);
        router.replace("/dashboard");
        return;
      }
      await refreshStats();
      setIsAdmin(true);
      setCheckingAccess(false);
    };
    void checkAdmin();
  }, [router, roleLoading, user?.id, role, refreshStats]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchHealth();
  }, [isAdmin, fetchHealth]);

  if (checkingAccess) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Resolving admin access...</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) return null;

  const m = health?.metrics || {};

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell
          roleKey={DASHBOARD_ROLE.admin}
          title="Marketplace Health"
          subtitle={`${welcomePhrase} · CRM activation metrics · ${DASHBOARD_ROLE_META[DASHBOARD_ROLE.admin].defaultSubtitle}`}
        >
          <div className={styles.adminWrapper}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <Link className={styles.dashboardLink} href="/admin">
                ← Admin Control Center
              </Link>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={healthLoading}
                onClick={() => void fetchHealth()}
              >
                {healthLoading ? "Refreshing…" : "Refresh health"}
              </button>
            </div>

            <AdminOperationalStats
              total={totals.listings}
              pending={totals.pending}
              approved={totals.approved}
              rejected={totals.rejected}
              archived={totals.archived}
              users={totals.users}
            />

            {healthError ? (
              <p className={styles.muted} role="alert" style={{ marginTop: 16 }}>
                {healthError}
              </p>
            ) : null}

            <section style={{ marginTop: 20 }} aria-label="Marketplace CRM metrics">
              <h2 className={styles.sectionTitle}>CRM & marketplace signals</h2>
              <div className={styles.operationalStatsGrid} style={{ marginTop: 12 }}>
                <HealthStat label="Listings (total)" value={m.listings_total} />
                <HealthStat label="Verified listings" value={m.listings_verified} />
                <HealthStat label="Pending review" value={m.listings_pending_review} />
                <HealthStat label="Open conversations" value={m.open_conversations} />
                <HealthStat label="Open viewings" value={m.open_viewings} sublabel="Pending or confirmed" />
                <HealthStat label="Notification queue (pending)" value={m.notification_queue_pending} />
                <HealthStat label="Notification queue (failed)" value={m.notification_queue_failed} />
                <HealthStat label="Events today" value={m.events_today} />
                <HealthStat label="Inquiries total" value={m.inquiries_total} />
                <HealthStat
                  label="Orphan records"
                  value={m.orphan_records}
                  sublabel="Broken conversation refs"
                />
              </div>
            </section>

            <section style={{ marginTop: 20 }} aria-label="Security and trust signals">
              <h2 className={styles.sectionTitle}>Security & trust (24h)</h2>
              <div className={styles.operationalStatsGrid} style={{ marginTop: 12 }}>
                <HealthStat label="Spam attempts" value={m.spam_attempts} sublabel="Honeypot + captcha fail" />
                <HealthStat label="Blocked (honeypot)" value={m.blocked_inquiries} />
                <HealthStat label="Rate limited" value={m.rate_limited_requests} />
                <HealthStat label="Captcha failures" value={m.captcha_failures} />
                <HealthStat
                  label="Notification latency (avg)"
                  value={m.notification_avg_latency_sec != null ? `${m.notification_avg_latency_sec}s` : "—"}
                  sublabel="Last 20 sent queue items"
                />
                <HealthStat
                  label="Inbox backlog (stale)"
                  value={m.inbox_backlog_stale}
                  sublabel="Open convos, no message 48h+"
                />
              </div>
            </section>

            <section className={styles.card} style={{ marginTop: 20 }} aria-label="Recent security events">
              <h3 className={styles.sectionTitle}>Recent security events</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {health?.recent_security_events?.length ? (
                  health.recent_security_events.map((ev) => (
                    <p key={ev.id} className={styles.muted}>
                      <span className={styles.liveDot} /> {ev.event_type}
                      {ev.listing_id ? ` · Listing ${ev.listing_id}` : ""}
                      {ev.sender_email ? ` · ${ev.sender_email}` : ""}
                      <br />
                      <time dateTime={ev.created_at}>{new Date(ev.created_at).toLocaleString()}</time>
                    </p>
                  ))
                ) : (
                  <PremiumEmptyState variant="activity" compact title="No security events logged yet" />
                )}
              </div>
            </section>

            <section className={styles.card} style={{ marginTop: 20 }} aria-label="Recent marketplace activity">
              <h3 className={styles.sectionTitle}>Recent activity</h3>
              <p className={styles.muted} style={{ marginBottom: 12 }}>
                Last 10 listing events and inquiries combined.
                {health?.updated_at ? ` Updated ${new Date(health.updated_at).toLocaleString()}.` : ""}
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {health?.recent_activity?.length ? (
                  health.recent_activity.map((item) => (
                    <p key={`${item.kind}-${item.id}`} className={styles.muted}>
                      <span className={styles.liveDot} /> {item.label} — {item.meta}
                      <br />
                      <time dateTime={item.stamp}>{new Date(item.stamp).toLocaleString()}</time>
                    </p>
                  ))
                ) : (
                  <PremiumEmptyState variant="activity" compact title="No recent CRM activity yet" />
                )}
              </div>
            </section>
          </div>
        </DashboardShell>
      </main>
    </div>
  );
}
