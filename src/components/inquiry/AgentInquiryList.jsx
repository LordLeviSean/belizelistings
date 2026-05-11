import { INQUIRY_CHANNEL, INQUIRY_STATUS } from "@/constants/inquiryModel";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import styles from "./AgentInquiryList.module.css";

function channelLabel(c) {
  if (c === INQUIRY_CHANNEL.VIEWING) return "Viewing request";
  if (c === INQUIRY_CHANNEL.QUESTION) return "Question";
  return "Contact";
}

export default function AgentInquiryList({
  inquiries,
  listingsById,
  busyId,
  onMarkResponded,
  onOpenListing,
}) {
  if (!inquiries?.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Open listing editor", href: "/dashboard/create" }}
        secondary={{ label: "View live site", href: "/" }}
      />
    );
  }

  return (
    <div className={styles.list} role="feed" aria-label="Inquiries">
      {inquiries.map((q) => {
        const title = listingsById?.[q.listing_id]?.title || `Listing ${String(q.listing_id || "").slice(0, 8)}…`;
        const unread = !q.read_at && q.status === INQUIRY_STATUS.NEW;
        return (
          <article key={q.id} className={`${styles.card} ${unread ? styles.cardUnread : ""}`}>
            <header className={styles.cardHead}>
              <span className={styles.channel}>{channelLabel(q.channel)}</span>
              <time className={styles.time} dateTime={q.created_at}>
                {q.created_at ? new Date(q.created_at).toLocaleString() : ""}
              </time>
            </header>
            <p className={styles.listingRef}>{title}</p>
            <p className={styles.body}>{q.body}</p>
            <dl className={styles.meta}>
              {q.sender_name ? (
                <div>
                  <dt>Name</dt>
                  <dd>{q.sender_name}</dd>
                </div>
              ) : null}
              {q.sender_email ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${encodeURIComponent(q.sender_email)}`}>{q.sender_email}</a>
                  </dd>
                </div>
              ) : null}
              {q.sender_phone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>{q.sender_phone}</dd>
                </div>
              ) : null}
            </dl>
            <div className={styles.actions}>
              {onOpenListing && q.listing_id ? (
                <button type="button" className={styles.secondary} onClick={() => onOpenListing(q.listing_id)}>
                  View listing
                </button>
              ) : null}
              {q.status === INQUIRY_STATUS.NEW ? (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busyId === q.id}
                  onClick={() => onMarkResponded?.(q.id)}
                >
                  {busyId === q.id ? "Updating…" : "Mark responded"}
                </button>
              ) : (
                <span className={styles.statusPill}>{q.status}</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
