import Link from "next/link";
import { formatListingLocation } from "@/lib/geography/formatListingLocation";
import { resolveListingEditHref } from "@/lib/listingEditAccess";

/**
 * Read-only location display with link to canonical create workspace for geography edits.
 */
export default function GeographyLocationEditLink({ listing, className }) {
  const label = formatListingLocation(listing) || "Location not set";
  const href = resolveListingEditHref(listing?.id);

  return (
    <div className={className}>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>{label}</p>
      <Link href={href} style={{ fontSize: 12, fontWeight: 600 }}>
        Edit location in listing workspace →
      </Link>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(72,96,92,0.72)" }}>
        Structured District → City/Town/Village → Neighborhood uses the shared geography editor.
      </p>
    </div>
  );
}
