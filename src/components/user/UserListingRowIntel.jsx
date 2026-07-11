import { memo, useMemo } from "react";
import opStyles from "@/components/operational/OperationalIntel.module.css";

function fmtMetric(n) {
  if (n == null || Number.isNaN(Number(n))) return "0";
  return Number(n).toLocaleString();
}

function buildRowIntel(listing) {
  const views = listing?.view_count ?? listing?.views ?? listing?.viewCount;
  const saves = listing?.favorite_count ?? listing?.favorites_count ?? listing?.favoriteCount;
  const inquiries = listing?.inquiry_count ?? listing?.inquiries_count ?? listing?.inquiryCount;
  const updated = listing?.updated_at || listing?.created_at;
  const lastUpdated =
    updated &&
    new Date(updated).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return {
    views: typeof views === "number" ? views : null,
    saves: typeof saves === "number" ? saves : null,
    inquiries: typeof inquiries === "number" ? inquiries : null,
    lastUpdated: lastUpdated || null,
  };
}

function UserListingRowIntel({ listing }) {
  const intel = useMemo(() => buildRowIntel(listing), [listing]);

  return (
    <div className={opStyles.performanceStrip} aria-label="Listing signals">
      <span>
        Views <strong>{fmtMetric(intel.views)}</strong>
      </span>
      <span>
        Saves <strong>{fmtMetric(intel.saves)}</strong>
      </span>
      <span>
        Inquiries <strong>{fmtMetric(intel.inquiries)}</strong>
      </span>
      <span>
        Updated <strong>{intel.lastUpdated || "—"}</strong>
      </span>
    </div>
  );
}

export default memo(UserListingRowIntel);
