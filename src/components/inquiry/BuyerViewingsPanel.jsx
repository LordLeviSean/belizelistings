import Link from "next/link";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { VIEWING_STATUS } from "@/lib/crm/crmConstants";
import listStyles from "./AgentInquiryList.module.css";

function statusLabel(status) {
  if (status === VIEWING_STATUS.CONFIRMED) return "Confirmed";
  if (status === VIEWING_STATUS.PENDING) return "Pending confirmation";
  if (status === VIEWING_STATUS.CANCELLED) return "Cancelled";
  if (status === VIEWING_STATUS.COMPLETED) return "Completed";
  return status || "Scheduled";
}

function formatViewingSlot(date, time) {
  if (!date) return "";
  const timeStr = time ? String(time).slice(0, 5) : "";
  const dt = new Date(`${date}T${timeStr || "12:00"}:00`);
  if (Number.isNaN(dt.getTime())) return `${date}${timeStr ? ` ${timeStr}` : ""}`;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: timeStr ? "numeric" : undefined,
    minute: timeStr ? "2-digit" : undefined,
  });
}

export default function BuyerViewingsPanel({ viewings = [], listingsById = {} }) {
  if (!viewings?.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Browse listings", href: "/" }}
      />
    );
  }

  return (
    <div className={listStyles.list} role="feed" aria-label="My viewings">
      {viewings.map((row) => {
        const title =
          listingsById?.[row.listing_id]?.title ||
          `Listing ${String(row.listing_id || "").slice(0, 8)}…`;
        return (
          <article key={row.id} className={listStyles.card}>
            <header className={listStyles.cardHead}>
              <span className={listStyles.channel}>Viewing</span>
              <time className={listStyles.time} dateTime={row.requested_date}>
                {formatViewingSlot(row.requested_date, row.requested_time)}
              </time>
            </header>
            <p className={listStyles.listingRef}>{title}</p>
            {row.notes ? <p className={listStyles.body}>{row.notes}</p> : null}
            <div className={listStyles.actions}>
              {row.listing_id ? (
                <Link className={listStyles.secondary} href={`/listing/${row.listing_id}`}>
                  View listing
                </Link>
              ) : null}
              <span className={listStyles.statusPill}>{statusLabel(row.status)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
