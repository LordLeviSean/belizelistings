import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import SiteNav from "@/components/SiteNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import { DashboardShell } from "@/components/dashboard";
import { DASHBOARD_ROLE, DASHBOARD_ROLE_META } from "@/constants/dashboardRoles";
import useUserRole from "@/hooks/useUserRole";
import { fetchBrokerTeamAgentIds } from "@/lib/brokerTeamScope";
import {
  AgentActivityFeed,
  ListingIntelStrip,
} from "@/components/operational";
import { getListingRegionSlug } from "@/utils/canonicalListing";
import { LISTING_HEALTH_TIER } from "@/constants/operationalIntel";
import { evaluateListingIntel } from "@/utils/listingIntel";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { fetchListingsForDashboardByUserIds } from "@/lib/listingQueries";
import styles from "@/styles/Dashboard.module.css";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";

export default function BrokerDashboard() {
  const router = useRouter();
  const { user, role, loading: roleLoading, welcomePhrase } = useUserRole();
  const [teamListings, setTeamListings] = useState([]);
  const [brokerageId, setBrokerageId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTeam = useCallback(async () => {
    if (!user?.id) {
      router.replace("/login");
      return;
    }
    if (role !== "broker" && role !== "brokerage" && role !== "property_manager") {
      router.replace("/dashboard");
      return;
    }

    // Brokerage scope columns are not on public.profiles in current migrations — useUserRole hydrate only.
    const bid = "";

    setBrokerageId(bid || "");

    const teammateIds = await fetchBrokerTeamAgentIds(supabase, bid);
    const scopeIds = [...new Set([user.id, ...teammateIds])];

    if (!bid || scopeIds.length === 0) {
      setTeamListings([]);
      setLoading(false);
      return;
    }

    const { data } = await fetchListingsForDashboardByUserIds(supabase, scopeIds);

    setTeamListings(data || []);
    setLoading(false);
  }, [router, role, user]);

  useEffect(() => {
    if (roleLoading) return;
    void loadTeam();
  }, [roleLoading, loadTeam]);

  const insights = useMemo(() => {
    const districtCounts = {};
    let staleCandidates = 0;
    let weakHealth = 0;
    for (const row of teamListings) {
      const slug = getListingRegionSlug(row) || row?.district || "unknown";
      districtCounts[slug] = (districtCounts[slug] || 0) + 1;
      const lc = getLifecycleStatus(row);
      if (lc === LISTING_LIFECYCLE.PUBLISHED) {
        const intel = evaluateListingIntel(row);
        if (intel.healthTier === LISTING_HEALTH_TIER.NEEDS_ATTENTION || intel.healthTier === LISTING_HEALTH_TIER.CRITICAL) {
          weakHealth += 1;
        }
        if (intel.freshness?.stale) staleCandidates += 1;
      }
    }
    const topDistricts = Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { topDistricts, staleCandidates, weakHealth, total: teamListings.length };
  }, [teamListings]);

  if (roleLoading || loading) {
    return (
      <div className={styles.page}>
        <SiteNav active="dashboard" />
        <main className={styles.main}>
          <p className={styles.muted}>Loading brokerage workspace…</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.page}>
      <SiteNav active="dashboard" />
      <main className={styles.main}>
        <DashboardShell
          roleKey={DASHBOARD_ROLE.broker}
          title="Brokerage Operations"
          subtitle={`${welcomePhrase} · ${DASHBOARD_ROLE_META[DASHBOARD_ROLE.broker].defaultSubtitle}`}
        >
          <div className={styles.adminWrapper}>
            <Breadcrumbs />

            {!brokerageId ? (
              <div className={`${styles.card} ${styles.archivedCard}`} style={{ maxWidth: 560 }}>
                <h2 style={{ marginTop: 0 }}>Team scope not linked yet</h2>
                <p className={styles.muted}>
                  Connect a <code>brokerage_id</code> on your profile to aggregate teammate inventory. Until then,
                  use agent dashboards per producer.
                </p>
                <Link href="/dashboard/user" className={styles.approveButton}>
                  Account settings
                </Link>
              </div>
            ) : (
              <>
                <div className={styles.brokerInsightGrid}>
                  <div className={styles.card}>
                    <p className={styles.draftResumeTitle}>Team inventory</p>
                    <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{insights.total}</p>
                    <p className={styles.muted}>Rows visible in brokerage scope</p>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.draftResumeTitle}>Needs operational polish</p>
                    <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{insights.weakHealth}</p>
                    <p className={styles.muted}>Published listings with health signals</p>
                  </div>
                  <div className={styles.card}>
                    <p className={styles.draftResumeTitle}>Stale risk (published)</p>
                    <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{insights.staleCandidates}</p>
                    <p className={styles.muted}>Based on listing intelligence freshness</p>
                  </div>
                </div>

                <div className={styles.card} style={{ marginBottom: 18 }}>
                  <p className={styles.draftResumeTitle}>Top districts</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {insights.topDistricts.map(([slug, n]) => (
                      <li key={slug}>
                        <strong>{slug}</strong> — {n} listing{n === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.agentIntelLayout}>
                  <AgentActivityFeed listings={teamListings} onOpenListing={(id) => router.push(`/listing/${id}`)} />
                  <div className={styles.agentListingColumn}>
                    <p className={styles.muted} style={{ marginBottom: 12 }}>
                      Team inventory preview — drill into listing detail for full context.
                    </p>
                    {teamListings.length === 0 ? (
                      <PremiumEmptyState
                        variant="broker"
                        compact
                        title="Team inventory is quiet in this scope"
                        description="As teammates publish approved listings, they gather here for structured brokerage oversight."
                        primary={{ label: "Create listing", href: "/dashboard/create" }}
                        secondary={{ label: "Agent workspace", href: "/dashboard/agent" }}
                      />
                    ) : (
                      <div className={styles.pendingGrid}>
                        {teamListings.slice(0, 24).map((l) => (
                          <div key={l.id} className={styles.card}>
                            <h3 style={{ margin: 0 }}>{l.title}</h3>
                            <p className={styles.muted}>{Number(l.price || 0).toLocaleString()} BZD</p>
                            <ListingIntelStrip listing={l} />
                            <button
                              type="button"
                              className={styles.approveButton}
                              style={{ marginTop: 10 }}
                              onClick={() => router.push(`/listing/${l.id}`)}
                            >
                              View public detail
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </DashboardShell>
      </main>
    </div>
  );
}
