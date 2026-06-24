/**
 * Allowed column names for `public.listings` INSERT/UPDATE payloads.
 * Keep aligned with the canonical inventory schema (see `supabase-listings-canonical-alignment.sql`
 * and additive step migrations). Operator occupancy columns (occupied_at, vacancy_status, …) are
 * intentionally omitted until `supabase-listings-canonical-alignment.sql` is applied. Stripping unknown
 * keys prevents PostgREST "column does not exist"
 * when the client sends fields the cache has not picked up yet; expand this list only when the DB
 * gains matching columns.
 */
export const ALLOWED_LISTINGS_COLUMNS = Object.freeze([
  "agency_name",
  "amenities",
  "approved_by",
  "archived_at",
  "archived_by",
  "baths",
  "beds",
  "brokerage_name",
  "category",
  "closed_at",
  "closed_by",
  "closing_verification_status",
  "currency",
  "deleted_at",
  "deleted_by",
  "description",
  "district",
  "expired_at",
  "features",
  "garage",
  "inventory_verification_status",
  "last_reviewed_at",
  "lifecycle_status",
  "listed_by",
  "listing_category",
  "listing_type",
  "managed_by",
  "market_type",
  "moderated_by",
  "moderation_notes",
  "moderation_status",
  "price",
  "property_type",
  "published_at",
  "published_by",
  "region_slug",
  "rejection_reason",
  "rented_at",
  "resubmission_notes",
  "review_status",
  "reviewed_at",
  "reviewed_by",
  "sold_at",
  "square_feet",
  "status",
  "subregion_slug",
  "title",
  "unit_id",
  "user_id",
  "verification_status",
  "verified_at",
  "verified_by",
  "created_at",
  "updated_at",
]);

export const ALLOWED_LISTINGS_COLUMN_KEYS = new Set(ALLOWED_LISTINGS_COLUMNS);
