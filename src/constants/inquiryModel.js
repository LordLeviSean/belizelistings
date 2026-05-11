export const INQUIRY_CHANNEL = Object.freeze({
  CONTACT: "contact",
  VIEWING: "viewing",
  QUESTION: "question",
});

export const INQUIRY_STATUS = Object.freeze({
  NEW: "new",
  RESPONDED: "responded",
  SCHEDULED: "scheduled",
  CLOSED: "closed",
});

/** Lightweight client-side quality gate before insert (spam foundation). */
export function scoreInquiryBody(body = "") {
  const t = String(body || "").trim();
  if (t.length < 8) return { ok: false, reason: "Please add a bit more detail." };
  if (t.length > 8000) return { ok: false, reason: "Message is too long." };
  const lower = t.toLowerCase();
  if (/(viagra|casino|crypto.*bonus|click here.*http)/i.test(lower)) {
    return { ok: false, reason: "Message could not be sent." };
  }
  let score = 50;
  if (t.length > 40) score += 15;
  if (/\d/.test(t)) score += 5;
  if (/@/.test(t)) score -= 20;
  return { ok: true, score: Math.min(100, Math.max(0, score)) };
}
