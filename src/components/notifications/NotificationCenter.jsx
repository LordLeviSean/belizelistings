import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { fetchInquiriesForAgent } from "@/lib/listingInquiries";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
import { LISTING_MODERATION_TOAST } from "@/constants/listingModerationNotifications";
import {
  AGENT_UPGRADE_REQUEST_STATUS,
  AGENT_UPGRADE_TOAST,
  formatAdminAgentUpgradeNotification,
} from "@/constants/agentUpgradeNotifications";
import { fetchPendingAgentUpgradeRequestForUser, fetchPendingAgentUpgradeRequests } from "@/lib/agentUpgradeRequests";
import { BL_ENABLE_NOTIFICATIONS } from "@/lib/featureFlags";
import { fetchNotifications, fetchUnreadNotificationCount, mapNotificationsForCenter } from "@/lib/notifications/fetchNotifications";
import { markNotificationRead } from "@/lib/notifications/markNotificationRead";
import {
  NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS,
  mergeNotificationCenterItems,
  patchNotificationCenterItemRead,
  prependDurableNotificationItem,
} from "@/lib/notifications/notificationCenterQuery";
import { mapNotificationRowToCenterItem } from "@/lib/notifications/notificationCopyRegistry";
import nav from "../SiteNavUnified.module.css";
import styles from "./NotificationCenter.module.css";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PENDING_OR =
  "status.eq.pending,moderation_status.eq.pending_review,lifecycle_status.eq.pending,lifecycle_status.eq.submitted";

export default function NotificationCenter({ layout = "nav", onNavigate } = {}) {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);
  const rootRef = useRef(null);
  const mountedRef = useRef(true);
  const loadInFlightRef = useRef(false);
  const isDrawer = layout === "drawer";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!user?.id || loading || loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setBusy(true);
    const supplemental = [];

    try {
      let durableItems = [];
      if (BL_ENABLE_NOTIFICATIONS) {
        const [{ data: notifRows, skipped }, unreadResult] = await Promise.all([
          fetchNotifications(supabase, user.id, {
            limit: 12,
            dropdownRetentionHours: NOTIFICATION_DROPDOWN_READ_RETENTION_HOURS,
          }),
          fetchUnreadNotificationCount(supabase, user.id),
        ]);
        if (!skipped && notifRows?.length) {
          durableItems = mapNotificationsForCenter(notifRows).map((item) => ({
            ...item,
            sortAt: item.when,
            when: formatWhen(item.when),
          }));
        }
        if (!unreadResult.skipped && mountedRef.current) {
          setUnreadBadgeCount(unreadResult.count ?? 0);
        }
      }

      if (role === "agent") {
        const inquiryItems = [];
        if (!BL_ENABLE_NOTIFICATIONS) {
          const { data: inq } = await fetchInquiriesForAgent(supabase, user.id, { limit: 10 });
          for (const row of inq || []) {
            const unread = !row.read_at && row.status === INQUIRY_STATUS.NEW;
            inquiryItems.push({
              id: `inq-${row.id}`,
              category: "inquiry",
              title: unread ? "New inquiry received" : "Inquiry update",
              detail: String(row.body || "A buyer left a note on your listing.").slice(0, 96),
              href: "/dashboard/agent",
              when: formatWhen(row.created_at),
              unread,
            });
          }
          inquiryItems.sort((a, b) => Number(b.unread) - Number(a.unread));
        }

        const { data: listingRows } = await supabase
          .from("listings")
          .select("id,title,updated_at,lifecycle_status,status,moderation_status")
          .eq("user_id", user.id)
          .limit(80);

        let pendingN = 0;
        let draftN = 0;
        for (const L of listingRows || []) {
          const lc = getLifecycleStatus(L);
          if (lc === LISTING_LIFECYCLE.PENDING_REVIEW) pendingN += 1;
          if (lc === LISTING_LIFECYCLE.DRAFT) draftN += 1;
        }

        const summaries = [];
        if (pendingN > 0) {
          summaries.push({
            id: "sum-pending",
            category: "moderation",
            title:
              pendingN === 1
                ? "Listing awaiting publication review"
                : "Listings awaiting publication review",
            detail: `${pendingN} in the moderation queue`,
            href: "/dashboard/agent",
            when: "",
            unread: true,
          });
        }
        if (draftN > 0) {
          summaries.push({
            id: "sum-drafts",
            category: "draft",
            title: "Draft in progress",
            detail: `${draftN} draft${draftN === 1 ? "" : "s"} in your workspace`,
            href: "/dashboard/create",
            when: "",
            unread: false,
          });
        }
        supplemental.push(...summaries, ...inquiryItems.slice(0, 8));
      } else if (role === "admin") {
        const [{ count, error }, upgradeResult] = await Promise.all([
          supabase.from("listings").select("id", { count: "exact", head: true }).or(PENDING_OR),
          fetchPendingAgentUpgradeRequests(),
        ]);
        const n = !error && typeof count === "number" ? count : 0;
        const upgradeRows = upgradeResult.data || [];
        for (const row of upgradeRows.slice(0, 5)) {
          supplemental.push({
            id: `admin-agent-upgrade-${row.id}`,
            category: "guidance",
            title: "Agent upgrade request",
            detail: formatAdminAgentUpgradeNotification(row.username || row.email),
            href: "/admin?tab=upgrades",
            when: formatWhen(row.requested_at),
            unread: true,
          });
        }
        supplemental.push({
          id: "admin-moderation",
          category: "moderation",
          title: n > 0 ? "Inventory awaiting review" : "Moderation queue clear",
          detail:
            n > 0
              ? `${n} listing${n === 1 ? "" : "s"} ready for a calm pass`
              : "New submissions will surface here when they arrive.",
          href: "/admin",
          when: "",
          unread: n > 0,
        });
      } else if (role === "broker" || role === "brokerage" || role === "property_manager") {
        supplemental.push({
          id: "broker-pulse",
          category: "guidance",
          title: "Team operational pulse",
          detail: "Approvals and roster context stay on your brokerage desk.",
          href: "/dashboard/broker",
          when: "",
          unread: false,
        });
      } else if (user) {
        const { data: listingRows } = await supabase
          .from("listings")
          .select("id,title,updated_at,lifecycle_status,status,moderation_status")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(40);

        let pendingN = 0;
        let draftN = 0;
        let approvedN = 0;
        let rejectedN = 0;
        for (const L of listingRows || []) {
          const lc = getLifecycleStatus(L);
          if (lc === LISTING_LIFECYCLE.PENDING_REVIEW) pendingN += 1;
          if (lc === LISTING_LIFECYCLE.DRAFT) draftN += 1;
          if (lc === LISTING_LIFECYCLE.PUBLISHED) approvedN += 1;
          if (lc === LISTING_LIFECYCLE.REJECTED) rejectedN += 1;
        }

        const summaries = [];
        if (pendingN > 0) {
          summaries.push({
            id: "sum-pending-user",
            category: "moderation",
            title:
              pendingN === 1
                ? "Listing awaiting publication review"
                : "Listings awaiting publication review",
            detail: `${pendingN} in the editorial queue`,
            href: role === "agent" ? "/dashboard/agent" : "/dashboard/user?tab=pending",
            when: "",
            unread: true,
          });
        }
        if (rejectedN > 0) {
          summaries.push({
            id: "sum-rejected-user",
            category: "moderation",
            title: rejectedN === 1 ? "Listing needs revisions" : "Listings need revisions",
            detail: LISTING_MODERATION_TOAST.REJECTED,
            href: role === "agent" ? "/dashboard/agent" : "/dashboard/user?tab=my-listings",
            when: "",
            unread: true,
          });
        }
        if (approvedN > 0) {
          summaries.push({
            id: "sum-approved-user",
            category: "guidance",
            title: approvedN === 1 ? "Listing published" : "Listings published",
            detail: LISTING_MODERATION_TOAST.APPROVED,
            href: role === "agent" ? "/dashboard/agent" : "/dashboard/user?tab=my-listings",
            when: "",
            unread: false,
          });
        }
        if (draftN > 0) {
          summaries.push({
            id: "sum-drafts-user",
            category: "draft",
            title: "Draft in progress",
            detail: `${draftN} draft${draftN === 1 ? "" : "s"} in your workspace`,
            href: "/dashboard/create",
            when: "",
            unread: false,
          });
        }
        if (summaries.length === 0) {
          summaries.push({
            id: "explorer",
            category: "guidance",
            title: "Operational awareness",
            detail: "Publishing opens editorial review signals and listing status updates here.",
            href: "/dashboard/user",
            when: "",
            unread: false,
          });
        }

        const { data: pendingUpgrade } = await fetchPendingAgentUpgradeRequestForUser(user.id);
        if (pendingUpgrade?.id) {
          summaries.unshift({
            id: "agent-upgrade-pending",
            category: "guidance",
            title: "Agent upgrade pending",
            detail: "Your Agent access request is awaiting review.",
            href: "/dashboard/user",
            when: formatWhen(pendingUpgrade.requested_at),
            unread: true,
          });
        }

        const { data: recentUpgradeRows } = await supabase
          .from("agent_upgrade_requests")
          .select("id,status,reviewed_at,updated_at")
          .eq("user_id", user.id)
          .in("status", [AGENT_UPGRADE_REQUEST_STATUS.APPROVED, AGENT_UPGRADE_REQUEST_STATUS.REJECTED])
          .order("reviewed_at", { ascending: false })
          .limit(1);

        const recentUpgrade = recentUpgradeRows?.[0];
        if (recentUpgrade?.status === AGENT_UPGRADE_REQUEST_STATUS.APPROVED) {
          summaries.unshift({
            id: `agent-upgrade-approved-${recentUpgrade.id}`,
            category: "guidance",
            title: "Agent access approved",
            detail: AGENT_UPGRADE_TOAST.APPROVED,
            href: "/dashboard/agent",
            when: formatWhen(recentUpgrade.reviewed_at || recentUpgrade.updated_at),
            unread: false,
          });
        } else if (recentUpgrade?.status === AGENT_UPGRADE_REQUEST_STATUS.REJECTED) {
          summaries.unshift({
            id: `agent-upgrade-rejected-${recentUpgrade.id}`,
            category: "moderation",
            title: "Agent upgrade declined",
            detail: AGENT_UPGRADE_TOAST.REJECTED,
            href: "/dashboard/user",
            when: formatWhen(recentUpgrade.reviewed_at || recentUpgrade.updated_at),
            unread: true,
          });
        }

        supplemental.push(...summaries);
      }

      if (!mountedRef.current) return;
      setItems(
        mergeNotificationCenterItems({
          durableItems,
          supplementalItems: supplemental,
          limit: 10,
        })
      );
      if (!BL_ENABLE_NOTIFICATIONS) {
        setUnreadBadgeCount(supplemental.filter((item) => item.unread).length);
      }
    } catch {
      /* ignore */
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
      loadInFlightRef.current = false;
    }
  }, [user?.id, role, loading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`nav-notify-listings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_upgrade_requests", filter: `user_id=eq.${user.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  useEffect(() => {
    if (!user?.id || role !== "admin") return;
    const ch = supabase
      .channel(`nav-notify-admin-upgrades-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_upgrade_requests" },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, role, load]);

  useEffect(() => {
    if (!user?.id || role !== "agent" || BL_ENABLE_NOTIFICATIONS) return;
    const ch = supabase
      .channel(`nav-notify-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_inquiries", filter: `agent_user_id=eq.${user.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, role, load]);

  useEffect(() => {
    if (!user?.id || !BL_ENABLE_NOTIFICATIONS) return;
    const ch = supabase
      .channel(`nav-notify-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          const mapped = {
            ...mapNotificationRowToCenterItem(row),
            sortAt: row.created_at,
            when: formatWhen(row.created_at),
          };
          setItems((prev) => prependDurableNotificationItem(prev, mapped, 10));
          if (!row.read_at) {
            setUnreadBadgeCount((count) => count + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${user.id}` },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          if (row.read_at) {
            setItems((prev) => patchNotificationCenterItemRead(prev, row.id, row.read_at));
          } else {
            void load();
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id, load]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== "Escape" || !open) return;
      e.stopPropagation();
      setOpen(false);
    };
    if (open) window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [open]);

  if (!user) return null;

  if (loading) {
    const skeletonClass = isDrawer
      ? `${nav.navLink} ${nav.drawerNavLink} ${nav.navLinkIdle}`
      : `${nav.navLink} ${nav.navPillNotifications} ${nav.navLinkIdle}`;
    return (
      <div className={`${styles.root}${isDrawer ? ` ${styles.rootDrawer}` : ""}`}>
        <span className={skeletonClass} aria-busy="true" aria-label="Loading notifications">
          <span className={nav.navLinkInner}>
            <Loader2 className={`${nav.navIcon} ${nav.navIconSpin}`} strokeWidth={1.85} aria-hidden />
            Notifications
          </span>
        </span>
      </div>
    );
  }

  const unreadCount = BL_ENABLE_NOTIFICATIONS
    ? unreadBadgeCount
    : items.filter((x) => x.unread).length;
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);
  const triggerClass = isDrawer
    ? `${nav.navLink} ${nav.navBtn} ${nav.drawerNavLink} ${nav.navPillNotifications}`
    : `${nav.navLink} ${nav.navPillNotifications}`;

  const handleNotificationNavigate = useCallback(
    async (item) => {
      const href = item?.href;
      if (!href) return;

      setOpen(false);
      onNavigate?.();

      try {
        if (item.notificationId && item.unread && user?.id) {
          setItems((prev) => patchNotificationCenterItemRead(prev, item.notificationId));
          setUnreadBadgeCount((count) => Math.max(0, count - 1));
          await markNotificationRead(supabase, {
            notificationId: item.notificationId,
            userId: user.id,
          });
        }
        await router.push(href);
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[notifications] navigation failed", {
            href,
            message: err?.message || String(err),
          });
        }
      }
    },
    [onNavigate, router, user?.id]
  );

  return (
    <div className={`${styles.root}${isDrawer ? ` ${styles.rootDrawer}` : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`${triggerClass} ${
          open ? `${nav.navLinkActive} ${nav.navPillNotificationsActive}` : ""
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount
            ? `Notifications, ${unreadCount} unread operational updates`
            : "Notifications, operational updates"
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className={nav.navLinkInner}>
          <Bell className={nav.navIcon} fill="currentColor" strokeWidth={1.85} aria-hidden />
          Notifications
          {unreadCount > 0 ? (
            <span className={`${styles.unreadBadge} ${styles.unreadBadgePulse}`} aria-hidden>
              {badgeText}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div
          className={`${styles.panel}${isDrawer ? ` ${styles.panelDrawer}` : ""}`}
          role="dialog"
          aria-label="Operational updates"
          aria-modal={isDrawer ? "false" : "false"}
        >
          <div className={styles.panelInner}>
            <header className={styles.panelHead}>
              <div className={styles.panelTitles}>
                <h2 className={styles.panelTitle}>Operational updates</h2>
                <p className={styles.panelSubtitle}>
                  Recent activity across your inventory and inquiries.
                </p>
              </div>
              {busy ? <Loader2 className={`${nav.navIconSpin} ${styles.headSpinner}`} strokeWidth={1.85} aria-hidden /> : null}
            </header>

            <div className={styles.panelBody} aria-busy={busy || undefined}>
              {items.length === 0 ? (
                <p className={styles.empty}>
                  You&apos;re caught up — BelizeListings stays quiet until the next operational pulse.
                </p>
              ) : (
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`${styles.row} ${item.unread ? styles.rowUnread : ""}`}
                        onClick={() => void handleNotificationNavigate(item)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          void handleNotificationNavigate(item);
                        }}
                        aria-label={[item.title, item.detail, item.when].filter(Boolean).join(". ")}
                      >
                        <span
                          className={`${styles.glyph} ${styles[`glyph_${item.category}`]}${
                            item.unread ? ` ${styles.glyphUnread}` : ""
                          }`}
                          aria-hidden
                        />
                        <span className={styles.rowMain}>
                          <span className={styles.rowTitle}>{item.title}</span>
                          {item.detail ? <span className={styles.rowDetail}>{item.detail}</span> : null}
                          {item.when ? <span className={styles.rowWhen}>{item.when}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className={styles.panelFoot}>
              <button type="button" className={styles.refreshQuiet} onClick={() => void load()}>
                Refresh
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
