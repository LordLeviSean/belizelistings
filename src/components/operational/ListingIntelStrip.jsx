import ListingHealthBadge from "./ListingHealthBadge";
import ListingPerformanceStrip from "./ListingPerformanceStrip";
import OperationalWarningChips from "./OperationalWarningChips";
import { evaluateListingIntel } from "@/utils/listingIntel";
import opStyles from "./OperationalIntel.module.css";

/** Compact operational signals for a listing row — uses canonical lifecycle via evaluateListingIntel. */
export default function ListingIntelStrip({ listing }) {
  const intel = evaluateListingIntel(listing);
  return (
    <div className={opStyles.listingIntelCard}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        <ListingHealthBadge tier={intel.healthTier} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(72,102,93,0.62)" }}>
          Health {intel.healthScore}
        </span>
      </div>
      <OperationalWarningChips warnings={intel.warnings} max={5} />
      <ListingPerformanceStrip performance={intel.performance} />
    </div>
  );
}
