import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import useUserRole from "@/hooks/useUserRole";
import { fetchInquiriesForAgent } from "@/lib/listingInquiries";
import { INQUIRY_STATUS } from "@/constants/inquiryModel";
import { getLifecycleStatus } from "@/utils/canonicalListing";
import { LISTING_LIFECYCLE } from "@/constants/operationalModel";
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
  "status.eq.pending,moderation_status.eq.pending_review,lifecycle_status.eq.pending";

export default function NotificationCenter() {
  const router = useRouter();
  const { user, role, loading } = useUserRole();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id || loading) return;
    setBusy(true);
    const next = [];

    try {
      if (role === "agent") {
        const { data: inq } = await fetchInquiriesForAgent(supabase, user.id, { limit: 10 });
        const inquiryItems = [];
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
        next.push(...summaries, ...inquiryItems.slice(0, 8));
      } else if (role === "admin") {
        const { count, error } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .or(PENDING_OR);
        const n = !error && typeof count === "number" ? count : 0;
        next.push({
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
        next.push({
          id: "broker-pulse",
          category: "guidance",
          title: "Team operational pulse",
          detail: "Approvals and roster context stay on your brokerage desk.",
          href: "/dashboard/broker",
          when: "",
          unread: false,
        });
      } else if (user) {
        next.push({
          id: "explorer",
          category: "guidance",
          title: "Operational awareness",
          detail: "Publishing as an agent opens inquiries, drafts, and publication signals here.",
          href: "/dashboard/user",
          when: "",
          unread: false,
        });
      }
    } catch {
      /* ignore */
    }

    setItems(next.slice(0, 10));
    setBusy(false);
  }, [user?.id, role, loading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!user?.id || role !== "agent") return;
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
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  if (!user || loading) return null;

  const unreadCount = items.filter((x) => x.unread).length;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${nav.navLink} ${nav.navPillNotifications} ${open ? nav.navPillNotificationsActive : ""} ${styles.bellButton}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount ? `Updates, ${unreadCount} unread` : "Operational updates"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={nav.navLinkInner}>
          <Bell className={`${nav.navIcon} ${styles.bellIcon}`} strokeWidth={1.85} aria-hidden />
        </span>
        {unreadCount > 0 ? <span className={styles.unreadDot} aria-hidden /> : null}
      </button>

      {open ? (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Operational updates"
          aria-modal="false"
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

            <div className={styles.panelBody}>
              {items.length === 0 ? (
                <p className={styles.empty}>
                  You&apos;re caught up — BelizeListings stays quiet until the next operational pulse.
                </p>
              ) : (
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`${styles.row} ${item.unread ? styles.rowUnread : ""}`}
                        onClick={() => {
                          setOpen(false);
                          if (item.href.startsWith("/dashboard") || item.href.startsWith("/admin")) {
                            router.prefetch(item.href);
                          }
                        }}
                      >
                        <span className={`${styles.glyph} ${styles[`glyph_${item.category}`]}`} aria-hidden />
                        <span className={styles.rowMain}>
                          <span className={styles.rowTitle}>{item.title}</span>
                          {item.detail ? <span className={styles.rowDetail}>{item.detail}</span> : null}
                          {item.when ? <span className={styles.rowWhen}>{item.when}</span> : null}
                        </span>
                      </Link>
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
