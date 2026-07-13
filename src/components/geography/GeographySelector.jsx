import { useEffect, useMemo, useState } from "react";
import {
  getAreaOptionsForMapRegion,
  getLocalityOptionsForCommunity,
  getMapRegionsForSelector,
  isHighwaySelection,
} from "@/lib/geography/belizeGeographyV1";
import styles from "./GeographySelector.module.css";

function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  required,
}) {
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.name?.toLowerCase().includes(q) ||
        o.slug?.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (selected) setQuery(selected.label);
    else if (!value) setQuery("");
  }, [value, selected]);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <span className={styles.req}> *</span> : null}
      </label>
      <input
        id={id}
        className={styles.searchInput}
        list={`${id}-list`}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          const hit = options.find(
            (o) => o.label.toLowerCase() === e.target.value.trim().toLowerCase()
          );
          if (hit) onChange(hit.id);
          else if (!e.target.value.trim()) onChange("");
        }}
        onBlur={() => {
          if (selected) setQuery(selected.label);
        }}
      />
      <datalist id={`${id}-list`}>
        {filtered.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
      <select
        className={styles.nativeSelect}
        aria-hidden="true"
        tabIndex={-1}
        value={value || ""}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          const hit = options.find((o) => o.id === e.target.value);
          if (hit) setQuery(hit.label);
        }}
      >
        <option value="">{placeholder}</option>
        {filtered.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

/**
 * Three-tier geography selector: District/Region → City/Town/Village/Highway → Locality/Mile
 */
export default function GeographySelector({
  value = {},
  onChange,
  errors = {},
  disabled = false,
}) {
  const mapRegionSlug = value.map_region_slug || "";
  const areaId = value.community_id || value.highway_id || value.road_corridor_id || "";
  const localityId = value.locality_id || "";
  const highwayMile = value.highway_mile ?? "";

  const mapRegions = getMapRegionsForSelector();
  const areaOptions = mapRegionSlug ? getAreaOptionsForMapRegion(mapRegionSlug) : [];
  const selectedArea = areaOptions.find((o) => o.id === areaId);
  const isHighway = selectedArea?.kind === "highway";
  const localityOptions =
    selectedArea?.kind === "community" ? getLocalityOptionsForCommunity(areaId) : [];

  const emit = (patch) => {
    onChange?.({ ...value, ...patch });
  };

  const handleMapRegion = (slug) => {
    emit({
      map_region_slug: slug,
      community_id: "",
      highway_id: "",
      road_corridor_id: "",
      locality_id: "",
      highway_mile: "",
      locality_not_listed: false,
      locality_not_listed_note: "",
    });
  };

  const handleArea = (id) => {
    const opt = areaOptions.find((o) => o.id === id);
    const patch = {
      community_id: "",
      highway_id: "",
      road_corridor_id: "",
      locality_id: "",
      highway_mile: "",
      locality_not_listed: false,
    };
    if (opt?.kind === "highway") patch.highway_id = id;
    else if (opt?.kind === "road_corridor") patch.road_corridor_id = id;
    else patch.community_id = id;
    emit(patch);
  };

  const mapRegionOptions = mapRegions.map((mr) => ({
    id: mr.slug,
    slug: mr.slug,
    name: mr.name,
    label:
      mr.slug === "ambergris-caye" || mr.slug === "caye-caulker"
        ? mr.name
        : `${mr.name} District`,
  }));

  return (
    <div className={styles.root}>
      <SearchableSelect
        id="geo-map-region"
        label="District / Region"
        value={mapRegionSlug}
        onChange={handleMapRegion}
        options={mapRegionOptions}
        placeholder="Select district or island region"
        disabled={disabled}
        error={errors.map_region_slug}
        required
      />

      <SearchableSelect
        id="geo-area"
        label="City / Town / Village"
        value={areaId}
        onChange={handleArea}
        options={areaOptions}
        placeholder={mapRegionSlug ? "Select area" : "Select a region first"}
        disabled={disabled || !mapRegionSlug}
        error={errors.community_id}
        required
      />

      {isHighway ? (
        <div className={styles.field}>
          <label htmlFor="geo-mile" className={styles.label}>
            Mile (optional)
          </label>
          <input
            id="geo-mile"
            type="number"
            min="1"
            step="0.1"
            className={styles.mileInput}
            value={highwayMile}
            disabled={disabled}
            placeholder="e.g. 12"
            onChange={(e) => emit({ highway_mile: e.target.value })}
          />
          {errors.highway_mile ? <p className={styles.error}>{errors.highway_mile}</p> : null}
        </div>
      ) : localityOptions.length > 0 ? (
        <>
          <SearchableSelect
            id="geo-locality"
            label="Neighborhood / Locality"
            value={localityId}
            onChange={(id) => emit({ locality_id: id, locality_not_listed: false })}
            options={localityOptions}
            placeholder="Optional — select neighborhood"
            disabled={disabled || !areaId}
            error={errors.locality_id}
          />
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={Boolean(value.locality_not_listed)}
              disabled={disabled || Boolean(localityId)}
              onChange={(e) =>
                emit({
                  locality_not_listed: e.target.checked,
                  locality_id: e.target.checked ? "" : localityId,
                })
              }
            />
            <span>Neighborhood / Locality Not Listed</span>
          </label>
          {value.locality_not_listed ? (
            <div className={styles.field}>
              <label htmlFor="geo-not-listed-note" className={styles.label}>
                Describe locality (admin review)
              </label>
              <input
                id="geo-not-listed-note"
                className={styles.searchInput}
                value={value.locality_not_listed_note || ""}
                disabled={disabled}
                onChange={(e) => emit({ locality_not_listed_note: e.target.value })}
              />
              {errors.locality_not_listed_note ? (
                <p className={styles.error}>{errors.locality_not_listed_note}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : areaId && !isHighwaySelection(selectedArea) ? (
        <p className={styles.hint}>No neighborhoods listed for this area — you can save at this level.</p>
      ) : null}
    </div>
  );
}
