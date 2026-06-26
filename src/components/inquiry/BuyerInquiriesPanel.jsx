import Link from "next/link";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import { inquiryTypeLabel } from "@/lib/crm/crmConstants";
import listStyles from "./AgentInquiryList.module.css";

export default function BuyerInquiriesPanel({ inquiries = [], listingsById = {} }) {
  if (!inquiries?.length) {
    return (
      <PremiumEmptyState
        variant="inquiries"
        compact
        primary={{ label: "Browse listings", href: "/" }}
      />
    );
  }

  return (
    <div className={listStyles.list} role="feed" aria-label="My inquiries">
      {inquiries.map((row) => {
        const title =
          listingsById?.[row.listing_id]?.title ||
          `Listing ${String(row.listing_id || "").slice(0, 8)}…`;
        const body = row.message || row.body || "";
        return (
          <article key={row.id} className={listStyles.card}>
            <header className={listStyles.cardHead}>
              <span className={listStyles.channel}>{inquiryTypeLabel(row.inquiry_type)}</span>
              <time className={listStyles.time} dateTime={row.created_at}>
                {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
              </time>
            </header>
            <p className={listStyles.listingRef}>{title}</p>
            {body ? <p className={listStyles.body}>{body}</p> : null}
            <div className={listStyles.actions}>
              {row.listing_id ? (
                <Link className={listStyles.secondary} href={`/listing/${row.listing_id}`}>
                  View listing
                </Link>
              ) : null}
              <span className={listStyles.statusPill}>{row.status || row.pipeline_stage}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
