/**
 * Allowed column names for `public.listings` INSERT/UPDATE payloads.
 * Must match production `information_schema.columns` — expand only after migrations add columns.
 *
 * Stripping unknown keys prevents PostgREST "column does not exist" on PATCH when the client
 * sends enrichment fields (lifecycle, geography, actors) before the DB catches up.
 *
 * After applying lifecycle/moderation migrations, append e.g.:
 * lifecycle_status, moderation_status, region_slug, subregion_slug,
 * listed_by, managed_by, reviewed_by, moderated_by, published_by, verified_by,
 * archived_by, closed_by, deleted_by, published_at, verified_at, archived_at,
 * rented_at, sold_at, expired_at, deleted_at, reviewed_at, last_reviewed_at,
 * occupancy_status, vacancy_status, occupied_at, vacated_at,
 * maintenance_hold, seasonal_hold, verification_status,
 * moderation_notes, rejection_reason, resubmission_notes
 */
export const ALLOWED_LISTINGS_COLUMNS = Object.freeze([
  "user_id",
  "title",
  "price",
  "currency",
  "property_type",
  "district",
  "listing_type",
  "beds",
  "baths",
  "garage",
  "description",
  "amenities",
  "features",
  "square_feet",
  "unit_id",
  "status",
  "created_at",
  "updated_at",
]);

export const ALLOWED_LISTINGS_COLUMN_KEYS = new Set(ALLOWED_LISTINGS_COLUMNS);
