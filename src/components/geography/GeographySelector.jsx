import {
  getAreaOptionsForMapRegion,
  getLocalityOptionsForCommunity,
  getMapRegionOptionsForSelector,
  isHighwaySelection,
} from "@/lib/geography/belizeGeographyV1";
import styles from "./GeographySelector.module.css";

function NativeSelect({
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
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <span className={styles.req}> *</span> : null}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
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

  const mapRegionOptions = getMapRegionOptionsForSelector();
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

  return (
    <div className={styles.root}>
      <NativeSelect
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

      <NativeSelect
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
          <NativeSelect
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
                className={styles.textInput}
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
