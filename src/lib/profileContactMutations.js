import { isMissingColumnError } from "./supabaseCompat";
import { isProfileComplete } from "./isProfileComplete";
import { PROFILE_CONTACT_UPDATE_RETURN_TIERS } from "./profileSelectContract";

function trimOrNull(value) {
  const t = String(value ?? "").trim();
  return t || null;
}

/**
 * Build profiles UPDATE payload for contact section save.
 * @param {object} fields
 */
export function buildProfileContactPayload(fields = {}) {
  const phone = trimOrNull(fields.phone);
  const now = new Date().toISOString();
  const payload = {
    phone,
    whatsapp: trimOrNull(fields.whatsapp),
    brokerage_name: trimOrNull(fields.brokerage_name ?? fields.brokerageName),
    brokerage_phone: trimOrNull(fields.brokerage_phone ?? fields.brokeragePhone),
    contact_email_display: trimOrNull(fields.contact_email_display ?? fields.contactEmailDisplay),
    show_email_public: fields.show_email_public !== false && fields.showEmailPublic !== false,
    show_phone_public: fields.show_phone_public !== false && fields.showPhonePublic !== false,
    updated_at: now,
  };

  if (isProfileComplete({ phone, profile_completed_at: fields.profile_completed_at })) {
    payload.profile_completed_at = fields.profile_completed_at || now;
  }

  return payload;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} userId
 * @param {object} fields
 */
export async function updateProfileContact(client, userId, fields) {
  if (!client || !userId) {
    return { data: null, error: { message: "Missing client or user id" } };
  }

  const payload = buildProfileContactPayload(fields);
  if (!payload.phone || String(payload.phone).replace(/\D/g, "").length < 7) {
    return { data: null, error: { message: "A valid phone number is required." } };
  }

  let lastError = null;
  for (const columns of PROFILE_CONTACT_UPDATE_RETURN_TIERS) {
    const result = await client
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select(columns)
      .maybeSingle();

    if (!result.error) {
      return result;
    }
    lastError = result.error;
    if (!isMissingColumnError(result.error)) {
      break;
    }
  }

  return { data: null, error: lastError };
}
