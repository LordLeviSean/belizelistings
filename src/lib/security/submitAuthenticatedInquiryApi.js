/**
 * Authenticated inquiry submission via server API (immediate notification + push delivery).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ data: object | null, error: { message: string, code?: string } | null }>}
 */
export async function submitAuthenticatedInquiryViaApi(client, payload) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token ?? null;

  if (!token) {
    return {
      data: null,
      error: { message: "authentication_required", code: "authentication_required" },
    };
  }

  const res = await fetch("/api/inquiries/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listingId: payload.listingId,
      senderName: payload.senderName ?? null,
      senderEmail: payload.senderEmail ?? null,
      senderPhone: payload.senderPhone ?? null,
      message: payload.message ?? payload.body ?? "",
      inquiryType: payload.inquiryType ?? null,
      preferredContactMethod: payload.preferredContactMethod ?? "email",
      qualityScore: payload.qualityScore ?? null,
      requestedDate: payload.requestedDate ?? null,
      requestedTime: payload.requestedTime ?? null,
      company_website: payload.company_website ?? "",
    }),
  });

  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    return {
      data: null,
      error: {
        message: body.error || body.message || "Could not send message.",
        code: body.code,
      },
    };
  }

  return { data: body.data ?? body, error: null };
}
