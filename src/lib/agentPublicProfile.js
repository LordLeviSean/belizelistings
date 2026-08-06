import { isMissingRelationshipError, isMissingColumnError } from "./supabaseCompat";
import { filterBrowsableInventory, getListingRegionSlug } from "../utils/canonicalListing";
import { mapListingWithImages } from "../utils/listingImage";
import {
  fetchPublicAgentProfileByUsername,
  PROFILE_PUBLIC_AGENT_SELECT,
} from "./profileSelectContract";

const PUBLIC_AGENT_ROLES = new Set(["agent", "broker"]);

/**
 * Group canonical public inventory by owner user_id (directory counts).
 * @param {object[]} rows
 */
export function groupPublicListingsByUserId(rows) {
  const publicByAgent = {};
  for (const row of filterBrowsableInventory(rows || [])) {
    const uid = row?.user_id;
    if (!uid) continue;
    if (!publicByAgent[uid]) publicByAgent[uid] = [];
    publicByAgent[uid].push(row);
  }
  return publicByAgent;
}

/**
 * Public inventory rows for one owner — same path for profile pages and directory counts.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} userId
 */
export async function fetchPublicListingsForUser(supabaseClient, userId) {
  if (!supabaseClient || !userId) return [];

  const selectWithImages = `*, listing_images (*)`;

  let { data, error } = await supabaseClient
    .from("listings")
    .select(selectWithImages)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error && isMissingRelationshipError(error)) {
    ({ data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(120));
  }

  if (error) return [];

  return filterBrowsableInventory((data || []).map((row) => mapListingWithImages(row)));
}

/**
 * Public agent profile payload — graceful empty when RLS or username lookup fails.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} rawUsername
 */
export async function fetchAgentPublicProfile(supabaseClient, rawUsername) {
  const username = String(rawUsername || "").trim();
  if (!username) {
    return { profile: null, listings: [], unavailable: false };
  }

  const { data: profile, error: profileError } = await fetchPublicAgentProfileByUsername(
    supabaseClient,
    username
  );

  if (profileError || !profile?.id) {
    return { profile: null, listings: [], unavailable: Boolean(profileError) };
  }

  const role = String(profile.role || "").toLowerCase();
  if (!PUBLIC_AGENT_ROLES.has(role)) {
    return { profile: null, listings: [], unavailable: false };
  }

  const listings = await fetchPublicListingsForUser(supabaseClient, profile.id);
  return { profile, listings, unavailable: false };
}

/**
 * Derive unique region labels from public listing rows.
 * @param {object[]} listings
 */
export function deriveAgentProfileRegions(listings) {
  const slugs = new Set();
  for (const row of listings || []) {
    const slug = getListingRegionSlug(row);
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

/**
 * Approved agents for public directory — role=agent with username.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 */
export async function fetchAgentDirectory(supabaseClient) {
  if (!supabaseClient) return { agents: [], unavailable: true };

  let profiles = [];
  let profilesError = null;

  for (const columns of PROFILE_PUBLIC_AGENT_SELECT) {
    const result = await supabaseClient
      .from("profiles")
      .select(columns)
      .in("role", ["agent", "broker"])
      .not("username", "is", null)
      .order("username", { ascending: true });

    if (!result.error) {
      profiles = result.data || [];
      profilesError = null;
      break;
    }
    profilesError = result.error;
    if (!isMissingColumnError(result.error)) {
      break;
    }
  }

  if (profilesError) {
    return { agents: [], unavailable: true };
  }

  const agents = (profiles || []).filter((p) => String(p?.username || "").trim());
  if (!agents.length) {
    return { agents: [], unavailable: false };
  }

  const agentsWithListings = await Promise.all(
    agents.map(async (profile) => {
      const listings = await fetchPublicListingsForUser(supabaseClient, profile.id);
      return {
        profile,
        listingCount: listings.length,
        regions: deriveAgentProfileRegions(listings),
      };
    })
  );

  return {
    agents: agentsWithListings,
    unavailable: false,
  };
}
