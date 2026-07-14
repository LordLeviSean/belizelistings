import { useMemo } from "react";
import {
  getAreaOptionsForMapRegion,
  getLocalityOptionsForCommunity,
  getMapRegionOptionsForSelector,
} from "@/lib/geography/belizeGeographyV1";
import styles from "./GeographySelector.module.css";

/**
 * Dependent discovery filters: District/Region -> Community -> Locality
 */
export default function GeographyDiscoveryFilters({ value = {}, onChange, disabled = false }) {
  const mapRegion = value.mapRegion || value.district || "";
  const communityId = value.communityId || "";
  const localityId = value.localityId || "";

  const mapRegions = useMemo(() => getMapRegionOptionsForSelector(), []);
  const areaOptions = mapRegion ? getAreaOptionsForMapRegion(mapRegion) : [];
  const localityOptions = communityId
    ? getLocalityOptionsForCommunity(communityId).map((l) => ({
        id: l.id,
        label: l.label,
      }))
    : [];

  const emit = (patch) => onChange?.({ ...value, ...patch });

  return (
    <div className={styles.root}>
      <label className={styles.field}>
        <span className={styles.label}>District / Region</span>
        <select
          className={styles.searchInput}
          value={mapRegion}
          disabled={disabled}
          onChange={(e) =>
            emit({
              mapRegion: e.target.value,
              district: e.target.value,
              communityId: "",
              localityId: "",
              subregion: "",
            })
          }
        >
          <option value="">All regions</option>
          {mapRegions.map((mr) => (
            <option key={mr.id} value={mr.slug}>
              {mr.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>City / Town / Village</span>
        <select
          className={styles.searchInput}
          value={communityId}
          disabled={disabled || !mapRegion}
          onChange={(e) =>
            emit({
              communityId: e.target.value,
              localityId: "",
              subregion: "",
            })
          }
        >
          <option value="">All communities</option>
          {areaOptions
            .filter((a) => a.kind === "community")
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Neighborhood / Locality</span>
        <select
          className={styles.searchInput}
          value={localityId}
          disabled={disabled || !communityId || localityOptions.length === 0}
          onChange={(e) => emit({ localityId: e.target.value })}
        >
          <option value="">All localities</option>
          {localityOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
