import { useMemo } from "react";
import { buildAgentActivityFeed, mergeActivityWithInquiries } from "@/utils/listingIntel";
import ActivityFeedCard from "./ActivityFeedCard";
import PremiumEmptyState from "@/components/ui/PremiumEmptyState";
import opStyles from "./OperationalIntel.module.css";

function formatFeedTime(ts) {
  if (ts == null) return "";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AgentActivityFeed({ listings, inquiries = [], onOpenListing }) {
  const items = useMemo(() => {
    const base = buildAgentActivityFeed(listings, { limit: 24 });
    return mergeActivityWithInquiries(base, inquiries, { limit: 18 });
  }, [listings, inquiries]);

  return (
    <aside className={opStyles.activityPanel} aria-label="Operational activity">
      <h2 className={opStyles.activityHeader}>Activity</h2>
      <div className={opStyles.activityList}>
        {items.length === 0 ? (
          <PremiumEmptyState variant="activity" compact className={opStyles.activityEmpty} />
        ) : (
          items.map((item) => (
            <ActivityFeedCard
              key={item.id}
              headline={item.headline}
              detail={item.detail}
              tone={item.tone}
              timeLabel={formatFeedTime(item.ts)}
              onOpen={
                onOpenListing && item.listingId != null
                  ? () => onOpenListing(item.listingId)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </aside>
  );
}
