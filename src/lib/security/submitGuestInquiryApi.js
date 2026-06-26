/**
 * Client-side POST to secure inquiry API (guest leads when Turnstile flag on).
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ data: object | null, error: { message: string, code?: string } | null }>}
 */
export async function submitGuestInquiryViaSecureApi(payload) {
  const res = await fetch("/api/inquiries/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      turnstileToken: payload.turnstileToken ?? null,
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
