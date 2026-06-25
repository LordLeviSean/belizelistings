const KNOWN_SECTIONS = [
  "overview",
  "highlights",
  "features",
  "additional notes",
  "additional information",
  "location",
  "amenities",
];

const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}(?:[\s.-]?\d{1,6})?/g;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

const BULLET_RE = /^[\s]*(?:[-*•–—]|\d+[.)])\s+/;
const HEADING_RE = /^(?:#{1,3}\s+|[*_]{1,2})?(.+?)(?:[*_]{1,2})?\s*:?\s*$/;

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHeading(raw) {
  return String(raw || "")
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
}

function isSectionHeading(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;
  const match = trimmed.match(HEADING_RE);
  if (!match) return false;
  const normalized = normalizeHeading(match[1]);
  return KNOWN_SECTIONS.includes(normalized);
}

function extractHeadingLabel(line) {
  const match = String(line || "").trim().match(HEADING_RE);
  if (!match) return String(line || "").trim();
  const normalized = normalizeHeading(match[1]);
  const known = KNOWN_SECTIONS.find((s) => s === normalized);
  if (known) {
    return known
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return match[1].trim();
}

function stripBulletPrefix(line) {
  return String(line || "").replace(BULLET_RE, "").trim();
}

function isBulletLine(line) {
  return BULLET_RE.test(String(line || ""));
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

/**
 * Split plain text into inline segments (text, phone, url).
 * @param {string} text
 * @returns {Array<{ type: 'text'|'phone'|'url', value: string, href?: string }>}
 */
export function parseInlineDescriptionSegments(text) {
  const input = String(text || "");
  if (!input.trim()) return [];

  const markers = [];

  for (const match of input.matchAll(PHONE_RE)) {
    const raw = match[0];
    const digits = normalizePhoneDigits(raw);
    if (digits.replace(/\D/g, "").length < 7) continue;
    markers.push({
      start: match.index,
      end: match.index + raw.length,
      type: "phone",
      value: raw,
      href: `tel:${digits}`,
    });
  }

  for (const match of input.matchAll(URL_RE)) {
    const raw = match[0].replace(/[.,;:!?)]+$/, "");
    const start = match.index;
    const end = start + raw.length;
    const overlapsPhone = markers.some((m) => start >= m.start && start < m.end);
    if (overlapsPhone) continue;
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    markers.push({ start, end, type: "url", value: raw, href });
  }

  markers.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const marker of markers) {
    if (marker.start < cursor) continue;
    if (marker.start > cursor) {
      segments.push({ type: "text", value: input.slice(cursor, marker.start) });
    }
    segments.push({
      type: marker.type,
      value: marker.value,
      href: marker.href,
    });
    cursor = marker.end;
  }

  if (cursor < input.length) {
    segments.push({ type: "text", value: input.slice(cursor) });
  }

  return segments.length ? segments : [{ type: "text", value: input }];
}

/**
 * Parse listing description into structured blocks for detail page rendering.
 * @param {string} raw
 * @returns {Array<{ type: 'heading'|'paragraph'|'list', text?: string, items?: string[], label?: string }>}
 */
export function parseListingDescriptionBlocks(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = [];

  const flushParagraph = () => {
    const joined = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    paragraphBuffer = [];
    if (joined) blocks.push({ type: "paragraph", text: joined });
  };

  const flushList = () => {
    const items = listBuffer.map(stripBulletPrefix).filter(Boolean);
    listBuffer = [];
    if (items.length) blocks.push({ type: "list", items });
  };

  for (const line of lines) {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    if (isSectionHeading(trimmed)) {
      flushList();
      flushParagraph();
      blocks.push({ type: "heading", label: extractHeadingLabel(trimmed) });
      continue;
    }

    if (isBulletLine(trimmed)) {
      flushParagraph();
      listBuffer.push(trimmed);
      continue;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  }

  flushList();
  flushParagraph();

  if (blocks.length === 0) {
    return [{ type: "paragraph", text }];
  }

  return blocks;
}

export { escapeHtml };
