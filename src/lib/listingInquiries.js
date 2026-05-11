import { INQUIRY_STATUS } from "../constants/inquiryModel";

/**
 * Insert a public inquiry row. Requires `listing_inquiries` table + RLS (see supabase-listing-inquiries.sql).
 */
export async function submitListingInquiry(supabase, payload) {
  const row = {
    listing_id: payload.listingId,
    agent_user_id: payload.agentUserId,
    sender_user_id: payload.senderUserId ?? null,
    sender_name: payload.senderName ?? null,
    sender_email: payload.senderEmail ?? null,
    sender_phone: payload.senderPhone ?? null,
    channel: payload.channel,
    body: payload.body,
    status: INQUIRY_STATUS.NEW,
    quality_score: payload.qualityScore ?? null,
    read_at: null,
    updated_at: new Date().toISOString(),
  };

  return supabase.from("listing_inquiries").insert(row).select("id,created_at").single();
}

export async function fetchInquiriesForAgent(supabase, agentUserId, { limit = 80 } = {}) {
  return supabase
    .from("listing_inquiries")
    .select(
      "id,listing_id,channel,body,status,sender_name,sender_email,sender_phone,read_at,created_at,updated_at"
    )
    .eq("agent_user_id", agentUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function updateInquiryStatus(supabase, { inquiryId, agentUserId, status }) {
  return supabase
    .from("listing_inquiries")
    .update({
      status,
      updated_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    })
    .eq("id", inquiryId)
    .eq("agent_user_id", agentUserId);
}

export async function markInquiryRead(supabase, { inquiryId, agentUserId }) {
  return supabase
    .from("listing_inquiries")
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId)
    .eq("agent_user_id", agentUserId)
    .is("read_at", null);
}
