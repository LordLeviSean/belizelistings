import { supabase } from "./supabaseClient";
import { getModerationStatus, LISTING_LIFECYCLE } from "../constants/operationalModel";
import {
  isMissingColumnError,
  isMissingRelationshipError,
} from "./supabaseCompat";
import { filterBrowsableInventory, isListingPubliclyVisible } from "../utils/canonicalListing";
import { mapListingWithImages } from "../utils/listingImage";
import { normalizeUserDashboardListingRows } from "./userDashboardListingTruth";
import {
  LISTING_CREATE_WORKSPACE_SELECT_TIERS,
  LISTING_CREATE_WORKSPACE_TIER_CACHE_KEY,
  LISTING_OWNER_DASHBOARD_COLUMNS,
  LISTING_OWNER_DASHBOARD_COLUMNS_WITH_INTEL,
  LISTING_OWNER_DASHBOARD_IMAGES_EMBED,
  buildOwnerDashboardListingsSelect,
  executeListingDashboardSelectQuery,
} from "./listingDashboardSelectContract";
import { extractMissingColumnName } from "./supabaseCompat";

export {
  LISTING_OWNER_DASHBOARD_COLUMNS,
  LISTING_OWNER_DASHBOARD_COLUMNS_WITH_INTEL,
  LISTING_OWNER_DASHBOARD_IMAGES_EMBED,
  buildOwnerDashboardListingsSelect,
} from "./listingDashboardSelectContract";

function logListingDashboardQueryFailure(scope, error, meta = {}) {
  console.error(`[${scope}] load`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    missingColumn: meta.missingColumn ?? extractMissingColumnName(error),
    tierIndex: meta.tierIndex,
    select: meta.select,
    terminal: meta.terminal,
  });
}

/**
 * Per-owner listings for user dashboards (My Listings). Tiered contract fallbacks;
 * embed failures degrade to empty `listing_images` — never hard-fail the dashboard.
 */
export async function fetchUserOwnedListingsForDashboard(supabaseClient, userId) {
  if (!supabaseClient || !userId) {
    return { data: [], error: null, terminal: false };
  }

  const { data, error, terminal, tierIndex, select, missingColumn } =
    await executeListingDashboardSelectQuery(
    supabaseClient,
    (selectLiteral) =>
      supabaseClient
        .from("listings")
        .select(selectLiteral)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
  );

  if (error) {
    logListingDashboardQueryFailure("user-my-listings", error, {
      terminal,
      tierIndex,
      select,
      missingColumn,
    });
    return { data: [], error, terminal };
  }

  let normalized = normalizeUserDashboardListingRows(data);
  const missingImageIds = normalized
    .filter((row) => !(row?.listing_images || []).length)
    .map((row) => row.id)
    .filter(Boolean);
  if (missingImageIds.length > 0) {
    const { data: imageRows, error: imageError } = await supabaseClient
      .from("listing_images")
      .select("id,image_url,position,listing_id")
      .in("listing_id", missingImageIds)
      .order("position", { ascending: true });
    if (!imageError && (imageRows || []).length > 0) {
      const byListingId = {};
      for (const img of imageRows) {
        const lid = String(img.listing_id);
        if (!byListingId[lid]) byListingId[lid] = [];
        byListingId[lid].push(img);
      }
      normalized = normalized.map((row) => {
        const extra = byListingId[String(row.id)];
        return extra?.length ? { ...row, listing_images: extra } : row;
      });
    }
  }

  return { data: normalized, error: null, terminal: false };
}

/**
 * Team-scope listings for broker dashboards (same contract as user owner fetch).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string[]} userIds
 */
export async function fetchListingsForDashboardByUserIds(supabaseClient, userIds) {
  const scopeIds = [...new Set((userIds || []).map(String).filter(Boolean))];
  if (!supabaseClient || scopeIds.length === 0) {
    return { data: [], error: null, terminal: false };
  }

  const { data, error, terminal } = await executeListingDashboardSelectQuery(
    supabaseClient,
    (select) =>
      supabaseClient
        .from("listings")
        .select(select)
        .in("user_id", scopeIds)
        .order("updated_at", { ascending: false })
        .limit(400)
  );

  if (error) {
    return { data: [], error, terminal };
  }
  return { data: normalizeUserDashboardListingRows(data), error: null, terminal: false };
}

/**
 * Single listing row for post-create staging (same shape as {@link fetchUserOwnedListingsForDashboard}).
 */
export async function fetchListingRowForUserDashboard(supabaseClient, listingId) {
  if (!supabaseClient || !listingId) return { data: null, error: null, terminal: false };

  const { data, error, terminal } = await executeListingDashboardSelectQuery(
    supabaseClient,
    (select) =>
      supabaseClient.from("listings").select(select).eq("id", listingId).maybeSingle()
  );

  if (error) {
    return { data: null, error, terminal };
  }
  let row = data[0] ?? null;
  if (row) {
    const embedded = Array.isArray(row.listing_images) ? row.listing_images.filter(Boolean) : [];
    if (embedded.length === 0) {
      const { data: imageRows, error: imageError } = await fetchListingImageRowsForListing(
        supabaseClient,
        listingId
      );
      if (!imageError && imageRows.length > 0) {
        row = { ...row, listing_images: imageRows };
      }
    }
  }
  return {
    data: row ? normalizeUserDashboardListingRows([row])[0] : null,
    error: null,
    terminal: false,
  };
}

/**
 * Direct listing_images fetch when embed tier degraded or cache omitted rows.
 */
export async function fetchListingImageRowsForListing(supabaseClient, listingId) {
  if (!supabaseClient || !listingId) return { data: [], error: null };
  const { data, error } = await supabaseClient
    .from("listing_images")
    .select("id,image_url,position")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });
  if (error) return { data: [], error };
  return { data: (data || []).filter(Boolean), error: null };
}

/**
 * Draft row hydrate for create workspace (explicit columns + image embed fallbacks).
 */
export async function fetchListingDraftForCreateWorkspace(supabaseClient, listingId) {
  if (!supabaseClient || !listingId) return { data: null, error: null, terminal: false };

  const { data, error, terminal } = await executeListingDashboardSelectQuery(
    supabaseClient,
    (select) =>
      supabaseClient.from("listings").select(select).eq("id", listingId).maybeSingle(),
    { tiers: LISTING_CREATE_WORKSPACE_SELECT_TIERS, tierCacheKey: LISTING_CREATE_WORKSPACE_TIER_CACHE_KEY }
  );

  if (error) {
    return { data: null, error, terminal };
  }
  let row = data[0] ?? null;
  if (!row) {
    return { data: null, error: null, terminal: false };
  }

  const embedded = Array.isArray(row.listing_images) ? row.listing_images.filter(Boolean) : [];
  if (embedded.length === 0) {
    const { data: imageRows, error: imageError } = await fetchListingImageRowsForListing(
      supabaseClient,
      listingId
    );
    if (!imageError && imageRows.length > 0) {
      row = { ...row, listing_images: imageRows };
    }
  }

  return {
    data: normalizeUserDashboardListingRows([row])[0],
    error: null,
    terminal: false,
  };
}

/**
 * Listing fetch patterns (RLS also applies):
 * - PUBLIC (browse + listing detail): published listings.
 * - AGENT dashboard: `.eq("user_id", user.id)` with lifecycle visibility filters.
 * - ADMIN: pending-review queue, or no status filter for full moderation list.
 */

function devWarnEmptyImages(listingCount, imageRowCount) {
  if (
    typeof window === "undefined" ||
    process.env.NODE_ENV !== "development" ||
    listingCount === 0 ||
    imageRowCount > 0
  ) {
    return;
  }
  console.warn(
    "[BelizeListings] Supabase returned approved listings but zero rows from `listing_images`. " +
      "The app is connected; add rows (listing_id, image_url, position) or check RLS policies allow SELECT for anon on `listing_images`."
  );
}

/**
 * Approved listings plus related listing_images rows.
 */
export async function fetchApprovedListingsWithImages(options = {}) {
  const limit = Number(options?.limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const selectWithImages = `
      *,
      listing_images (*)
    `;

  const approvedOrDual = `status.eq.${getModerationStatus("approved")},moderation_status.eq.approved`;
  const recentlyClosedOr = [
    `lifecycle_status.eq.${LISTING_LIFECYCLE.RECENTLY_SOLD}`,
    `lifecycle_status.eq.${LISTING_LIFECYCLE.RECENTLY_RENTED}`,
    `status.eq.${LISTING_LIFECYCLE.RECENTLY_SOLD}`,
    `status.eq.${LISTING_LIFECYCLE.RECENTLY_RENTED}`,
  ].join(",");

  let query = supabase
    .from("listings")
    .select(selectWithImages)
    .or(`${approvedOrDual},${recentlyClosedOr}`);

  if (hasLimit) {
    query = query.order("created_at", { ascending: false }).limit(limit);
  }

  let { data, error } = await query;
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("listings")
      .select(selectWithImages)
      .eq("status", getModerationStatus("approved")));
  }
  if (error && isMissingRelationshipError(error)) {
    ({ data, error } = await supabase.from("listings").select("*").or(approvedOrDual));
  }
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("status", getModerationStatus("approved")));
  }

  if (error) {
    console.error("[BelizeListings] listings fetch:", error.message, error);
    return { data: [], error };
  }

  const normalized = filterBrowsableInventory(
    (data || []).map((listing) => mapListingWithImages(listing))
  );
  const imageRowCount = normalized.reduce((sum, listing) => sum + (listing.images?.length || 0), 0);
  devWarnEmptyImages(normalized.length, imageRowCount);

  return { data: normalized, error: null };
}

export async function fetchListingByIdWithImages(id, isAdmin = false, options = {}) {
  const ownerUserId = options?.ownerUserId ? String(options.ownerUserId) : "";
  const listingSelect = `
      *,
      listing_images (
        id,
        image_url,
        position
      )
    `;

  let query = supabase.from("listings").select(listingSelect).eq("id", id);

  if (!isAdmin) {
    const approvedOrDual = `status.eq.${getModerationStatus("approved")},moderation_status.eq.approved`;
    const recentlyClosedOr = [
      `lifecycle_status.eq.${LISTING_LIFECYCLE.RECENTLY_SOLD}`,
      `lifecycle_status.eq.${LISTING_LIFECYCLE.RECENTLY_RENTED}`,
      `status.eq.${LISTING_LIFECYCLE.RECENTLY_SOLD}`,
      `status.eq.${LISTING_LIFECYCLE.RECENTLY_RENTED}`,
    ].join(",");
    query = query.or(`${approvedOrDual},${recentlyClosedOr}`);
  }

  let { data: listing, error } = await query.maybeSingle();
  if (error && !isAdmin && isMissingColumnError(error)) {
    const fallbackQuery = supabase
      .from("listings")
      .select(listingSelect)
      .eq("id", id)
      .eq("status", getModerationStatus("approved"));
    ({ data: listing, error } = await fallbackQuery.maybeSingle());
  }
  if (error && !isAdmin && isMissingRelationshipError(error)) {
    const fallbackQuery = supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .or(`status.eq.${getModerationStatus("approved")},moderation_status.eq.approved`);
    ({ data: listing, error } = await fallbackQuery.maybeSingle());
  }
  if (error && !isAdmin && isMissingColumnError(error)) {
    const fallbackQuery = supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .eq("status", getModerationStatus("approved"));
    ({ data: listing, error } = await fallbackQuery.maybeSingle());
  }

  if (!listing && ownerUserId) {
    const ownerQuery = supabase
      .from("listings")
      .select(listingSelect)
      .eq("id", id)
      .eq("user_id", ownerUserId);
    let ownerResult = await ownerQuery.maybeSingle();
    if (ownerResult.error && isMissingRelationshipError(ownerResult.error)) {
      ownerResult = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("user_id", ownerUserId)
        .maybeSingle();
    }
    listing = ownerResult.data ?? null;
    error = ownerResult.error ?? null;
  }

  if (error) {
    console.error("[BelizeListings] listing fetch:", error.message, error);
    return { data: null, error };
  }

  if (!listing) {
    return { data: null, error: null };
  }

  if (!isAdmin && !isListingPubliclyVisible(listing)) {
    const isOwner =
      ownerUserId && String(listing.user_id || "") === ownerUserId;
    if (!isOwner) {
      return { data: null, error: null };
    }
  }

  let imageRows = Array.isArray(listing.listing_images) ? listing.listing_images : [];
  if (imageRows.length === 0) {
    const { data: fetchedImages } = await fetchListingImageRowsForListing(supabase, id);
    if (fetchedImages.length > 0) {
      imageRows = fetchedImages;
      listing = { ...listing, listing_images: fetchedImages };
    }
  }

  listing = mapListingWithImages({ ...listing, listing_images: imageRows });

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && imageRows.length === 0) {
    console.warn(
      `[BelizeListings] No listing_images rows for listing id=${listing.id}. Add rows in Supabase or check RLS.`
    );
  }

  return {
    data: listing,
    error: null,
    ownerPreview:
      Boolean(ownerUserId) &&
      String(listing.user_id || "") === ownerUserId &&
      !isListingPubliclyVisible(listing),
  };
}
