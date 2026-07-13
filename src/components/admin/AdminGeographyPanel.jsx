import { getMapRegionsForSelector, getGeographyTotals } from "@/lib/geography/belizeGeographyV1";

/**
 * Minimal admin read-only geography hierarchy surface (V1.0).
 */
export default function AdminGeographyPanel() {
  const regions = getMapRegionsForSelector();
  const totals = getGeographyTotals();

  return (
    <section style={{ padding: "16px 0" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Belize Geography V1</h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(72,96,92,0.78)" }}>
        Reference hierarchy seeded from approved v3 dataset. Admin can add localities and aliases via
        database tools; user submissions use &quot;Neighborhood / Locality Not Listed&quot; on Create Listing.
      </p>
      <ul style={{ fontSize: 13, lineHeight: 1.5 }}>
        <li>Map regions: {regions.length}</li>
        <li>Total geography records: {totals.total_geography_records ?? 387}</li>
        <li>Communities: {totals.communities_total ?? 232}</li>
        <li>Localities: {totals.localities ?? 107}</li>
        <li>Highways: {totals.national_highways ?? 5}</li>
        <li>Records requires review: {totals.records_requires_review ?? 0}</li>
      </ul>
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>Map regions</summary>
        <ol style={{ fontSize: 12, marginTop: 8 }}>
          {regions.map((r) => (
            <li key={r.id}>
              {r.name} ({r.slug})
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
